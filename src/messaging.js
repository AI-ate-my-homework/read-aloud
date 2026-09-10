export const TARGET_BACKGROUND = "background";
export const TARGET_OFFSCREEN = "offscreen";
export const TARGET_CONTENT = "content";

export const MSG = {
  START_SYNTHESIS: "START_SYNTHESIS",
  CANCEL_SYNTHESIS: "CANCEL_SYNTHESIS",
  MODEL_PROGRESS: "MODEL_PROGRESS",
  VOICES_LIST: "VOICES_LIST",
  CHUNK_READY: "CHUNK_READY",
  SYNTHESIS_COMPLETE: "SYNTHESIS_COMPLETE",
  SYNTHESIS_ERROR: "SYNTHESIS_ERROR",
  READ_FROM_SELECTION: "READ_FROM_SELECTION",
};

// chrome.runtime/tabs.sendMessage requires JSON-serializable payloads — an
// ArrayBuffer sent as-is arrives on the other side stripped to "{}". Wav
// chunks cross that boundary (offscreen -> background -> content script) as
// base64 instead.
export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
