import { KokoroTTS, env } from "./vendor/kokoro.web.js";
import { TARGET_OFFSCREEN, TARGET_BACKGROUND, MSG, arrayBufferToBase64 } from "./messaging.js";

env.wasmPaths = chrome.runtime.getURL("vendor/wasm/");

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const useWebGPU = "gpu" in navigator;
const device = useWebGPU ? "webgpu" : "wasm";
const dtype = useWebGPU ? "fp32" : "q8";

let ttsPromise = null;
let activeRequestId = null;

function send(msg) {
  chrome.runtime.sendMessage({ target: TARGET_BACKGROUND, ...msg }).catch(() => {});
}

function loadModel(tabId, requestId) {
  if (!ttsPromise) {
    ttsPromise = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype,
      device,
      progress_callback: (p) => {
        if (p.status === "progress") {
          const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
          send({ type: MSG.MODEL_PROGRESS, tabId, requestId, text: `Downloading voice model… ${pct}%` });
        } else if (p.status === "ready" || p.status === "done") {
          send({ type: MSG.MODEL_PROGRESS, tabId, requestId, text: "Preparing…" });
        }
      },
    }).then((tts) => {
      const voices = Object.entries(tts.voices).map(([id, v]) => ({ id, name: v.name || id }));
      send({ type: MSG.VOICES_LIST, tabId, requestId, voices });
      return tts;
    });
  }
  return ttsPromise;
}

async function handleStart({ tabId, requestId, sentences, voice, speed, offset }) {
  activeRequestId = requestId;
  const total = offset + sentences.length;
  try {
    const tts = await loadModel(tabId, requestId);
    if (activeRequestId !== requestId) return;

    for (let i = 0; i < sentences.length; i++) {
      if (activeRequestId !== requestId) return;
      const audio = await tts.generate(sentences[i], { voice, speed });
      if (activeRequestId !== requestId) return;
      send({ type: MSG.CHUNK_READY, tabId, requestId, index: offset + i, total, wav: arrayBufferToBase64(audio.toWav()) });
    }

    if (activeRequestId === requestId) {
      send({ type: MSG.SYNTHESIS_COMPLETE, tabId, requestId });
    }
  } catch (err) {
    send({ type: MSG.SYNTHESIS_ERROR, tabId, requestId, error: err?.message || String(err) });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== TARGET_OFFSCREEN) return;
  if (msg.type === MSG.START_SYNTHESIS) {
    handleStart(msg);
  } else if (msg.type === MSG.CANCEL_SYNTHESIS) {
    if (activeRequestId === msg.requestId) activeRequestId = null;
  }
});
