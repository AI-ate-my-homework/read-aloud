import { FloatingPlayer } from "./player-ui.js";
import { StreamingPlayer } from "./audio-engine.js";
import { splitIntoSentences } from "./text-utils.js";
import { encodeMp3 } from "./mp3-encoder.js";
import { TARGET_BACKGROUND, MSG, base64ToArrayBuffer } from "./messaging.js";

function newRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function startReadingSession({ title, text, onSessionEnd }) {
  const sentences = splitIntoSentences(text);
  const total = sentences.length;

  // Precomputed once so a selection -> chunk lookup is a single indexOf + a scan over
  // `total` offsets, never a re-walk of the page. `sentences` are plain strings (Readability
  // extracts text from a *cloned* document, so there's no live DOM node to key off of) —
  // this reconstructs the same joined-with-space text splitIntoSentences was derived from,
  // so a chunk's start offset in it can be found from its start offset in the selection.
  const chunkOffsets = [];
  {
    let cursor = 0;
    for (const s of sentences) {
      chunkOffsets.push(cursor);
      cursor += s.length + 1; // +1 for the joining space
    }
  }
  const joinedLower = sentences.join(" ").toLowerCase();

  // Selection text isn't guaranteed to appear verbatim (Readability may have stripped or
  // reflowed surrounding markup) — an unmatched selection falls back to the top of the
  // article rather than guessing.
  function findChunkIndexForSelection(selectionText) {
    const normalized = (selectionText || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalized) return 0;
    const pos = joinedLower.indexOf(normalized.slice(0, 80));
    if (pos === -1) return 0;
    let index = 0;
    for (let i = 0; i < chunkOffsets.length; i++) {
      if (chunkOffsets[i] <= pos) index = i;
      else break;
    }
    return index;
  }

  const state = {
    voice: "af_heart",
    speed: 1,
    currentIndex: 0,
    synthesizedThrough: 0, // count of chunks confirmed synthesized, for export gating
    requestId: null,
  };

  const audio = new StreamingPlayer({
    onChunkStart: (index) => {
      state.currentIndex = index;
      player.setProgress(index + 1, total);
    },
    onAllPlayed: () => {
      player.setPlaying(false);
      player.setStatus("Finished");
    },
  });
  audio.reset(total);

  const player = new FloatingPlayer({
    title,
    voices: [{ id: "af_heart", name: "Loading voices…" }],
    defaultVoice: state.voice,
    onPlayPause: async () => {
      if (audio.isPaused) {
        await audio.resume();
        player.setPlaying(true);
      } else {
        await audio.pause();
        player.setPlaying(false);
      }
    },
    onSkip: (dir) => {
      const target = Math.max(0, Math.min(total - 1, state.currentIndex + (dir > 0 ? 1 : 0)));
      audio.skipTo(target);
    },
    onVoiceChange: (voice) => {
      state.voice = voice;
      speakFrom(state.currentIndex);
    },
    onSpeedChange: (speed) => {
      state.speed = speed;
      speakFrom(state.currentIndex);
    },
    onExport: onExportClicked,
    onClose: () => {
      sendCancel();
      audio.destroy();
      player.destroy();
      onSessionEnd?.();
    },
  });
  player.attach();
  player.setProgress(0, total);

  if (total === 0) {
    player.setStatus("No readable text found on this page.");
    return {
      close: () => { player.destroy(); onSessionEnd?.(); },
      readFromSelection: () => {},
    };
  }

  function sendStart(fromIndex) {
    state.requestId = newRequestId();
    state.synthesizedThrough = fromIndex;
    player.setExportEnabled(false);
    chrome.runtime.sendMessage({
      target: TARGET_BACKGROUND,
      type: MSG.START_SYNTHESIS,
      requestId: state.requestId,
      voice: state.voice,
      speed: state.speed,
      sentences: sentences.slice(fromIndex),
      offset: fromIndex,
    });
  }

  function sendCancel() {
    if (state.requestId) {
      chrome.runtime.sendMessage({ target: TARGET_BACKGROUND, type: MSG.CANCEL_SYNTHESIS, requestId: state.requestId });
    }
  }

  // Single path for "start speaking at this chunk": the initial kick-off, voice/speed
  // changes, and read-from-selection all funnel through here so they can't drift apart.
  function speakFrom(index) {
    sendCancel();
    audio.purgeFrom(index);
    player.setProgress(index, total);
    sendStart(index);
    audio.resume();
    player.setPlaying(true);
  }

  function readFromSelection(selectionText) {
    speakFrom(findChunkIndexForSelection(selectionText));
  }

  async function onExportClicked() {
    if (state.synthesizedThrough < total) return;
    player.setExportBusy(true);
    try {
      const { samples, sampleRate } = audio.getPcmForExport();
      const blob = encodeMp3(samples, sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "narration").slice(0, 80).replace(/[^\w\- ]+/g, "_")}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      player.setExportBusy(false);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.requestId !== state.requestId) return;

    switch (msg.type) {
      case MSG.MODEL_PROGRESS:
        player.setStatus(msg.text || "Loading voice model…");
        break;
      case MSG.VOICES_LIST:
        player.setVoices(msg.voices, state.voice);
        break;
      case MSG.CHUNK_READY:
        audio.addChunk(msg.index, base64ToArrayBuffer(msg.wav));
        state.synthesizedThrough = msg.index + 1;
        player.setStatus(`Generating… ${msg.index + 1}/${total}`);
        break;
      case MSG.SYNTHESIS_COMPLETE:
        audio.markComplete();
        state.synthesizedThrough = total;
        player.setExportEnabled(true);
        player.setStatus(audio.isPaused ? "Paused" : "Reading…");
        break;
      case MSG.SYNTHESIS_ERROR:
        player.setStatus(`Error: ${msg.error}`);
        break;
    }
  });

  speakFrom(0); // AudioContext starts "suspended" by spec; speakFrom's resume() is what makes it play.

  return {
    close: () => {
      sendCancel();
      audio.destroy();
      player.destroy();
      onSessionEnd?.();
    },
    readFromSelection,
  };
}
