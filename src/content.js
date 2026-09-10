import { Readability } from "@mozilla/readability";
import { startReadingSession } from "./reader-session.js";
import { TARGET_CONTENT, MSG } from "./messaging.js";

function extractArticle() {
  const clone = document.cloneNode(true);
  let article = null;
  try {
    article = new Readability(clone).parse();
  } catch {
    article = null;
  }
  const text = (article?.textContent || document.body.innerText || "").trim();
  const title = article?.title || document.title;
  return { title, text };
}

function main() {
  if (window.__readAloudSession) {
    window.__readAloudSession.close();
    window.__readAloudSession = null;
    return;
  }

  const { title, text } = extractArticle();
  window.__readAloudSession = startReadingSession({
    title,
    text,
    onSessionEnd: () => {
      window.__readAloudSession = null;
    },
  });
}

// Registered before main() runs so it's already listening by the time background.js's
// triggerReadFromSelection() follows up a fresh inject with this message (see background.js).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== TARGET_CONTENT || msg.type !== MSG.READ_FROM_SELECTION) return;
  window.__readAloudSession?.readFromSelection(msg.selectionText || "");
});

main();
