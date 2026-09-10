import { TARGET_BACKGROUND, TARGET_OFFSCREEN, TARGET_CONTENT, MSG } from "./messaging.js";

const OFFSCREEN_URL = "offscreen.html";
const PDF_REDIRECT_RULE_ID = 1;
const READ_FROM_SELECTION_MENU_ID = "read-aloud-read-from-here";
const READ_FROM_SELECTION_COMMAND = "read-from-selection";
const FROM_TAB_TYPES = new Set([MSG.START_SYNTHESIS, MSG.CANCEL_SYNTHESIS]);

function isReadableTab(tab) {
  return Boolean(tab?.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith(chrome.runtime.getURL("")));
}

async function hasActiveSession(tab) {
  const [{ result } = {}] = await chrome.scripting
    .executeScript({ target: { tabId: tab.id }, func: () => Boolean(window.__readAloudSession) })
    .catch(() => [{ result: false }]);
  return Boolean(result);
}

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["WORKERS"],
    justification: "Runs the on-device Kokoro TTS model (ONNX/WASM) to synthesize speech without blocking the service worker.",
  });
}

// Redirects top-level navigations to a .pdf URL into our bundled pdf.js viewer,
// so we get the text layer without uploading the file anywhere. Covers the
// common case (URLs ending in .pdf); PDFs served without that extension are a
// known gap — see PRD risk "PDF interception reliability".
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: READ_FROM_SELECTION_MENU_ID,
    title: "Read from here",
    contexts: ["selection"],
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [PDF_REDIRECT_RULE_ID],
    addRules: [
      {
        id: PDF_REDIRECT_RULE_ID,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { regexSubstitution: `${chrome.runtime.getURL("pdf/viewer.html")}?file=\\1` },
        },
        condition: {
          regexFilter: "^(https?://.*\\.pdf(?:[?#].*)?)$",
          resourceTypes: ["main_frame"],
        },
      },
    ],
  });
});

// Re-injecting content.bundle.js on every click (the old approach) re-ran the whole
// module each time, including its top-level chrome.runtime.onMessage.addListener —
// so repeated clicks piled up duplicate listeners instead of cleanly toggling a single
// player. Checking first means we only ever inject the full bundle once per tab (to
// start a session); closing an existing one is a small direct call instead.
chrome.action.onClicked.addListener(async (tab) => {
  if (!isReadableTab(tab)) return;

  if (await hasActiveSession(tab)) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { window.__readAloudSession?.close(); window.__readAloudSession = null; },
    });
    return;
  }

  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.bundle.js"] });
});

// Shared by the context-menu item and the keyboard shortcut: makes sure a reading
// session exists for the tab (starting one from the top if it doesn't — content.js's
// bundle runs its extraction/session-start synchronously on inject, so the session
// is already set by the time executeScript resolves), then tells it to jump to the
// chunk matching the current selection.
async function triggerReadFromSelection(tab, selectionText) {
  if (!isReadableTab(tab)) return;

  if (!(await hasActiveSession(tab))) {
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
  const [{ result: selectionText } = {}] = await chrome.scripting
    .executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || "" })
    .catch(() => [{ result: "" }]);
  triggerReadFromSelection(tab, selectionText);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.target !== TARGET_BACKGROUND) return;

  if (FROM_TAB_TYPES.has(msg.type)) {
    ensureOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({ ...msg, target: TARGET_OFFSCREEN, tabId: sender.tab?.id });
    });
  } else if (msg.tabId) {
    // Originated in the offscreen document; relay to the tab that asked for it.
    chrome.tabs.sendMessage(msg.tabId, msg);
  }
});
