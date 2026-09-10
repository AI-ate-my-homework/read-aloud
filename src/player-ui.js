const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6zM12.5 18V6l8.5 6z" transform="scale(-1,1) translate(-24,0)"/></svg>`,
  fwd: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zM13 6v12l8.5-6z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>`,
};

// Pixel-art sleeping cat perched on the panel's top edge. Solid black to match the
// player's monochrome language, with a white drop-shadow glow (applied in CSS) since
// a flat black silhouette would otherwise vanish against the panel's own dark glass.
// The tail is its own <g> with an explicit transform-origin at the point it meets the
// body, so the CSS keyframe animation can rotate just the tail for a slow idle flick.
const CAT_SVG = `<svg viewBox="0 0 224 152" xmlns="http://www.w3.org/2000/svg">
<g fill="#0a0a0a"><rect x="56" y="0" width="8" height="8"/><rect x="16" y="8" width="8" height="8"/><rect x="48" y="8" width="24" height="8"/><rect x="8" y="16" width="24" height="8"/><rect x="40" y="16" width="40" height="8"/><rect x="0" y="24" width="72" height="8"/><rect x="8" y="32" width="72" height="8"/><rect x="0" y="40" width="80" height="8"/><rect x="0" y="48" width="136" height="8"/><rect x="0" y="56" width="144" height="8"/><rect x="0" y="64" width="64" height="8"/><rect x="80" y="64" width="16" height="8"/><rect x="112" y="64" width="48" height="8"/><rect x="0" y="72" width="168" height="8"/><rect x="0" y="80" width="168" height="8"/><rect x="8" y="88" width="160" height="8"/><rect x="8" y="96" width="168" height="8"/><rect x="8" y="104" width="160" height="8"/><rect x="8" y="112" width="160" height="8"/><rect x="16" y="120" width="152" height="8"/><rect x="24" y="128" width="136" height="8"/><rect x="32" y="136" width="112" height="8"/><rect x="48" y="144" width="88" height="8"/></g>
<g class="cat-tail" style="transform-origin:152px 96px" fill="#0a0a0a"><rect x="144" y="56" width="48" height="8"/><rect x="160" y="64" width="40" height="8"/><rect x="168" y="72" width="40" height="8"/><rect x="168" y="80" width="48" height="8"/><rect x="176" y="88" width="40" height="8"/><rect x="184" y="96" width="32" height="8"/><rect x="192" y="104" width="32" height="8"/><rect x="192" y="112" width="32" height="8"/><rect x="200" y="120" width="24" height="8"/><rect x="200" y="128" width="24" height="8"/><rect x="200" y="136" width="24" height="8"/><rect x="200" y="144" width="16" height="8"/></g>
<g fill="#8a8a8a"><rect x="64" y="64" width="16" height="8"/><rect x="96" y="64" width="16" height="8"/></g>
</svg>`;

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }

  .panel {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    width: 336px;
    max-width: calc(100vw - 32px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02)),
      rgba(12,12,13,0.62);
    background-blend-mode: normal;
    color: #ffffff;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 20px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.10),
      0 20px 48px rgba(0,0,0,0.5),
      0 2px 10px rgba(0,0,0,0.35);
    backdrop-filter: blur(22px) saturate(140%);
    -webkit-backdrop-filter: blur(22px) saturate(140%);
    padding: 14px 16px 16px;
    opacity: 0;
    transform: translateY(8px) scale(0.98);
    animation: rise 0.22s cubic-bezier(0.16,1,0.3,1) forwards;
  }
  @media (prefers-reduced-transparency: reduce) {
    .panel { background: #141416; backdrop-filter: none; -webkit-backdrop-filter: none; }
  }
  @keyframes rise { to { opacity: 1; transform: translateY(0) scale(1); } }

  .cat {
    position: absolute;
    top: -27px;
    left: 14px;
    width: 54px;
    height: 37px;
    pointer-events: none;
    z-index: 1;
    filter: drop-shadow(0 0 1.5px rgba(255,255,255,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.45));
  }
  .cat svg { width: 100%; height: 100%; display: block; }
  .cat-tail { animation: tail-flick 3.4s ease-in-out infinite; }
  @keyframes tail-flick {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-15deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cat-tail { animation: none; }
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    cursor: grab;
    user-select: none;
  }
  .header:active { cursor: grabbing; }
  .grip { color: rgba(255,255,255,0.32); flex-shrink: 0; width: 16px; height: 16px; }
  .grip svg { width: 100%; height: 100%; display: block; }
  .title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    color: #ffffff;
  }
  button.close {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
  }
  button.close svg { width: 14px; height: 14px; }
  button.close:hover { background: rgba(255,255,255,0.10); color: #fff; }

  .transport {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    margin-bottom: 14px;
  }
  button.icon {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    color: rgba(255,255,255,0.85);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s, transform 0.12s;
  }
  button.icon svg { width: 18px; height: 18px; }
  button.icon:hover:not(:disabled) { background: rgba(255,255,255,0.14); color: #fff; }
  button.icon:active:not(:disabled) { transform: scale(0.94); }
  button.icon:disabled { opacity: 0.3; cursor: default; }
  button.play {
    background: #ffffff;
    border: 1px solid #ffffff;
    color: #0a0a0a;
    width: 52px;
    height: 52px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06);
  }
  button.play svg { width: 22px; height: 22px; }
  button.play:hover:not(:disabled) { background: #f0f0f0; transform: translateY(-1px); }
  button.play:active:not(:disabled) { transform: scale(0.96); }

  .row { display: flex; align-items: center; gap: 8px; }
  .row + .row { margin-top: 10px; }

  select.voice {
    flex: 1;
    min-width: 0;
    background: rgba(255,255,255,0.06);
    color: #ffffff;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 7px 8px;
    font-size: 12.5px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.55'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 14px;
    padding-right: 24px;
  }
  select.voice:hover { background-color: rgba(255,255,255,0.10); }
  select.voice:focus-visible, button:focus-visible, input:focus-visible {
    outline: 2px solid rgba(255,255,255,0.7);
    outline-offset: 1px;
  }

  .speed-group {
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 2px;
    flex-shrink: 0;
  }
  button.step {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.75);
    width: 22px;
    height: 24px;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    border-radius: 7px;
  }
  button.step:hover:not(:disabled) { background: rgba(255,255,255,0.14); color: #fff; }
  button.step:disabled { opacity: 0.3; cursor: default; }
  .speed-label {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: #ffffff;
    width: 34px;
    text-align: center;
    flex-shrink: 0;
  }

  .progress-track {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.10);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #ffffff;
    width: 0%;
    transition: width 0.2s ease-out;
  }
  .sentence-count {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.45);
    flex-shrink: 0;
  }

  .footer { justify-content: space-between; }
  .status {
    font-size: 11.5px;
    color: rgba(255,255,255,0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  button.export {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.18);
    color: #ffffff;
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  button.export svg { width: 13px; height: 13px; }
  button.export:disabled { opacity: 0.35; cursor: default; }
  button.export:not(:disabled):hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.3); }
`;

export class FloatingPlayer {
  constructor({ title, voices, defaultVoice, onPlayPause, onSkip, onVoiceChange, onSpeedChange, onExport, onClose }) {
    this.callbacks = { onPlayPause, onSkip, onVoiceChange, onSpeedChange, onExport, onClose };
    this.speed = 1;
    this.host = document.createElement("div");
    this.host.style.all = "initial";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.shadow.appendChild(style);

    this.panel = document.createElement("div");
    this.panel.className = "panel";
    this.panel.innerHTML = `
      <div class="cat">${CAT_SVG}</div>
      <div class="row header">
        <span class="grip">${ICONS.grip}</span>
        <span class="title"></span>
        <button class="close" title="Close">${ICONS.close}</button>
      </div>
      <div class="transport">
        <button class="icon skip-back" title="Restart sentence">${ICONS.back}</button>
        <button class="icon play" title="Play/Pause">${ICONS.play}</button>
        <button class="icon skip-fwd" title="Skip sentence">${ICONS.fwd}</button>
      </div>
      <div class="row">
        <select class="voice"></select>
        <div class="speed-group">
          <button class="step speed-down" title="Slower">−</button>
          <span class="speed-label">1.0x</span>
          <button class="step speed-up" title="Faster">+</button>
        </div>
      </div>
      <div class="row">
        <div class="progress-track"><div class="progress-fill"></div></div>
        <span class="sentence-count"></span>
      </div>
      <div class="row footer">
        <span class="status">Loading voice model…</span>
        <button class="export" disabled>${ICONS.download}Export</button>
      </div>
    `;
    this.shadow.appendChild(this.panel);

    this.$ = (sel) => this.panel.querySelector(sel);
    this.$(".title").textContent = title || "Reading";
    this.$(".close").addEventListener("click", () => this.callbacks.onClose?.());
    this.$(".play").addEventListener("click", () => this.callbacks.onPlayPause?.());
    this.$(".skip-fwd").addEventListener("click", () => this.callbacks.onSkip?.(1));
    this.$(".skip-back").addEventListener("click", () => this.callbacks.onSkip?.(-1));
    this.$(".voice").addEventListener("change", (e) => this.callbacks.onVoiceChange?.(e.target.value));
    this.$(".speed-down").addEventListener("click", () => this._stepSpeed(-0.25));
    this.$(".speed-up").addEventListener("click", () => this._stepSpeed(0.25));
    this.$(".export").addEventListener("click", () => this.callbacks.onExport?.());

    this._initDrag();

    if (voices?.length) this.setVoices(voices, defaultVoice);
  }

  _stepSpeed(delta) {
    const next = Math.min(2, Math.max(0.75, Math.round((this.speed + delta) * 100) / 100));
    if (next === this.speed) return;
    this.speed = next;
    this.$(".speed-label").textContent = `${next.toFixed(2).replace(/0$/, "").replace(/\.$/, ".0")}x`;
    this.$(".speed-down").disabled = next <= 0.75;
    this.$(".speed-up").disabled = next >= 2;
    this.callbacks.onSpeedChange?.(next);
  }

  _initDrag() {
    const header = this.$(".header");
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;

    header.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.panel.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rect = this.panel.getBoundingClientRect();
      const maxRight = window.innerWidth - rect.width;
      const maxBottom = window.innerHeight - rect.height;
      this.panel.style.right = `${Math.min(maxRight, Math.max(0, startRight - dx))}px`;
      this.panel.style.bottom = `${Math.min(maxBottom, Math.max(0, startBottom - dy))}px`;
    });
    header.addEventListener("pointerup", () => { dragging = false; });
    header.addEventListener("pointercancel", () => { dragging = false; });
  }

  attach() {
    document.documentElement.appendChild(this.host);
  }

  destroy() {
    this.host.remove();
  }

  setVoices(voices, selected) {
    const sel = this.$(".voice");
    sel.innerHTML = voices
      .map((v) => `<option value="${v.id}"${v.id === selected ? " selected" : ""}>${v.name || v.id}</option>`)
      .join("");
  }

  setPlaying(isPlaying) {
    this.$(".play").innerHTML = isPlaying ? ICONS.pause : ICONS.play;
  }

  setStatus(text) {
    this.$(".status").textContent = text;
    this.$(".status").title = text;
  }

  setProgress(current, total) {
    const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
    this.$(".progress-fill").style.width = `${pct}%`;
    this.$(".sentence-count").textContent = total > 0 ? `${Math.min(current, total)}/${total}` : "";
  }

  setExportEnabled(enabled) {
    this.$(".export").disabled = !enabled;
  }

  setExportBusy(busy) {
    this.$(".export").innerHTML = busy ? "Exporting…" : `${ICONS.download}Export`;
    this.$(".export").disabled = busy;
  }
}
