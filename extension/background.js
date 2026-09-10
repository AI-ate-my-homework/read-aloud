var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/messaging.js
var TARGET_BACKGROUND, TARGET_OFFSCREEN, TARGET_CONTENT, MSG;
var init_messaging = __esm({
  "src/messaging.js"() {
    TARGET_BACKGROUND = "background";
    TARGET_OFFSCREEN = "offscreen";
    TARGET_CONTENT = "content";
    MSG = {
      START_SYNTHESIS: "START_SYNTHESIS",
      CANCEL_SYNTHESIS: "CANCEL_SYNTHESIS",
      MODEL_PROGRESS: "MODEL_PROGRESS",
      VOICES_LIST: "VOICES_LIST",
      CHUNK_READY: "CHUNK_READY",
      SYNTHESIS_COMPLETE: "SYNTHESIS_COMPLETE",
      SYNTHESIS_ERROR: "SYNTHESIS_ERROR",
      READ_FROM_SELECTION: "READ_FROM_SELECTION"
    };
  }
});

// src/background.js
var require_background = __commonJS({
  "src/background.js"() {
    init_messaging();
    var OFFSCREEN_URL = "offscreen.html";
    var PDF_REDIRECT_RULE_ID = 1;
    var READ_FROM_SELECTION_MENU_ID = "read-aloud-read-from-here";
    var READ_FROM_SELECTION_COMMAND = "read-from-selection";
    var FROM_TAB_TYPES = /* @__PURE__ */ new Set([MSG.START_SYNTHESIS, MSG.CANCEL_SYNTHESIS]);
    function isReadableTab(tab) {
      return Boolean(tab?.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith(chrome.runtime.getURL("")));
    }
    async function hasActiveSession(tab) {
      const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => Boolean(window.__readAloudSession) }).catch(() => [{ result: false }]);
      return Boolean(result);
    }
    async function ensureOffscreenDocument() {
      const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
      if (existing.length > 0) return;
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ["WORKERS"],
        justification: "Runs the on-device Kokoro TTS model (ONNX/WASM) to synthesize speech without blocking the service worker."
      });
    }
    chrome.runtime.onInstalled.addListener(async () => {
      chrome.contextMenus.create({
        id: READ_FROM_SELECTION_MENU_ID,
        title: "Read from here",
        contexts: ["selection"]
      });
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [PDF_REDIRECT_RULE_ID],
        addRules: [
          {
            id: PDF_REDIRECT_RULE_ID,
            priority: 1,
            action: {
              type: "redirect",
              redirect: { regexSubstitution: `${chrome.runtime.getURL("pdf/viewer.html")}?file=\\1` }
            },
            condition: {
              regexFilter: "^(https?://.*\\.pdf(?:[?#].*)?)$",
              resourceTypes: ["main_frame"]
            }
          }
        ]
      });
    });
    chrome.action.onClicked.addListener(async (tab) => {
      if (!isReadableTab(tab)) return;
      if (await hasActiveSession(tab)) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.__readAloudSession?.close();
            window.__readAloudSession = null;
          }
        });
        return;
      }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.bundle.js"] });
    });
    async function triggerReadFromSelection(tab, selectionText) {
      if (!isReadableTab(tab)) return;
      if (!await hasActiveSession(tab)) {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.bundle.js"] });
      }
      chrome.tabs.sendMessage(tab.id, { target: TARGET_CONTENT, type: MSG.READ_FROM_SELECTION, selectionText });
    }
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId !== READ_FROM_SELECTION_MENU_ID || !tab) return;
      triggerReadFromSelection(tab, info.selectionText || "");
    });
    chrome.commands.onCommand.addListener(async (command, tab) => {
      if (command !== READ_FROM_SELECTION_COMMAND || !tab) return;
      const [{ result: selectionText } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || "" }).catch(() => [{ result: "" }]);
      triggerReadFromSelection(tab, selectionText);
    });
    chrome.runtime.onMessage.addListener((msg, sender) => {
      if (msg.target !== TARGET_BACKGROUND) return;
      if (FROM_TAB_TYPES.has(msg.type)) {
        ensureOffscreenDocument().then(() => {
          chrome.runtime.sendMessage({ ...msg, target: TARGET_OFFSCREEN, tabId: sender.tab?.id });
        });
      } else if (msg.tabId) {
        chrome.tabs.sendMessage(msg.tabId, msg);
      }
    });
  }
});
export default require_background();
