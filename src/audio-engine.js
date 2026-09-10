// Schedules decoded WAV chunks back-to-back on the Web Audio timeline so
// sentence-to-sentence playback has no audible gap or click.
export class StreamingPlayer {
  constructor({ onChunkStart, onAllPlayed } = {}) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);

    this.buffers = new Map(); // index -> AudioBuffer, scheduling working-set (pruned after playback)
    this.archive = new Map(); // index -> AudioBuffer, kept for the lifetime of the session (MP3 export)
    this.total = 0;
    this.nextToSchedule = 0;
    this.nextStartTime = 0;
    // Every BufferSourceNode currently scheduled on the timeline, not just the one
    // audible right now — chunks are scheduled ahead as they decode (that's what makes
    // playback gapless), so several can be live at once. Tracking only the latest one
    // (the old `activeSource` field) meant purge/skip/reset only ever stopped the most
    // recently scheduled node, leaving earlier still-playing ones running — audible as
    // two overlapping voices right after a speed/voice change forces a resync.
    this.scheduledSources = new Set();
    this.finished = false;
    this.onChunkStart = onChunkStart || (() => {});
    this.onAllPlayed = onAllPlayed || (() => {});
  }

  _stopAllScheduled() {
    for (const source of this.scheduledSources) {
      source.onended = null; // don't let a stopped node's onended re-trigger scheduling for the state we're about to reset
      try { source.stop(); } catch { /* already stopped */ }
    }
    this.scheduledSources.clear();
  }

  reset(total) {
    this.buffers.clear();
    this.archive.clear();
    this.total = total;
    this.nextToSchedule = 0;
    this.nextStartTime = 0;
    this.finished = false;
    this._stopAllScheduled();
  }

  async addChunk(index, wavArrayBuffer) {
    const buffer = await this.ctx.decodeAudioData(wavArrayBuffer.slice(0));
    this.buffers.set(index, buffer);
    this.archive.set(index, buffer);
    this._tryScheduleNext();
  }

  _tryScheduleNext() {
    const buffer = this.buffers.get(this.nextToSchedule);
    if (!buffer) return;

    const index = this.nextToSchedule;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);

    const startAt = Math.max(this.nextStartTime, this.ctx.currentTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.scheduledSources.add(source);
    this.nextToSchedule += 1;

    source.onended = () => {
      this.scheduledSources.delete(source);
      this.buffers.delete(index);
      const isLast = this.finished && this.nextToSchedule >= this.total;
      if (isLast) {
        this.onAllPlayed();
        return;
      }
      this._tryScheduleNext();
    };

    this.onChunkStart(index, this.total);
  }

  markComplete() {
    this.finished = true;
    if (this.total === 0) this.onAllPlayed();
  }

  pause() {
    return this.ctx.suspend();
  }

  resume() {
    return this.ctx.resume();
  }

  get isPaused() {
    return this.ctx.state === "suspended";
  }

  // Skips ahead to the given sentence index. Only works for chunks already
  // synthesized (arrived) or about to arrive; the caller is responsible for
  // requesting re-synthesis of anything before `index` that was skipped.
  skipTo(index) {
    this._stopAllScheduled();
    for (const key of [...this.buffers.keys()]) {
      if (key < index) this.buffers.delete(key);
    }
    this.nextToSchedule = index;
    this.nextStartTime = this.ctx.currentTime;
    this._tryScheduleNext();
  }

  // Used when voice/speed changes force re-synthesis: unlike skipTo(), this discards
  // buffers at and after `index` instead of keeping them, since they were rendered
  // with the old parameters and are no longer valid.
  purgeFrom(index) {
    this._stopAllScheduled();
    for (const key of [...this.buffers.keys()]) if (key >= index) this.buffers.delete(key);
    for (const key of [...this.archive.keys()]) if (key >= index) this.archive.delete(key);
    this.nextToSchedule = index;
    this.nextStartTime = this.ctx.currentTime;
    this.finished = false;
  }

  // Concatenates every synthesized chunk, in index order, for MP3 export.
  // Only meaningful once synthesis (not necessarily playback) has fully completed —
  // callers should check that against `total` before calling this.
  getPcmForExport() {
    const ordered = [...this.archive.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    let length = 0;
    for (const buf of ordered) length += buf.length;
    const out = new Float32Array(length);
    let offset = 0;
    for (const buf of ordered) {
      out.set(buf.getChannelData(0), offset);
      offset += buf.length;
    }
    return { samples: out, sampleRate: this.ctx.sampleRate };
  }

  destroy() {
    this._stopAllScheduled();
    this.ctx.close();
  }
}
