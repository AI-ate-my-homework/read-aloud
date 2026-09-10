import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import { startReadingSession } from "./reader-session.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf/pdf.worker.mjs");

const pagesEl = document.getElementById("pages");
const statusEl = document.getElementById("status");

function fileUrlFromQuery() {
  const params = new URLSearchParams(location.search);
  return params.get("file");
}

async function renderPage(page) {
  const viewport = page.getViewport({ scale: 1.25 });
  const canvas = document.createElement("canvas");
  canvas.className = "pdf-page";
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  pagesEl.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
}

async function main() {
  const fileUrl = fileUrlFromQuery();
  if (!fileUrl) {
    statusEl.textContent = "No PDF specified.";
    return;
  }
  document.title = decodeURIComponent(fileUrl.split("/").pop() || "PDF");

  statusEl.textContent = "Fetching PDF…";
  const resp = await fetch(fileUrl);
  const data = await resp.arrayBuffer();

  statusEl.textContent = "Rendering…";
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    await renderPage(page);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((it) => it.str).join(" "));
    statusEl.textContent = `Rendering… page ${i}/${pdf.numPages}`;
  }
  statusEl.remove();

  const text = pageTexts.join("\n\n");
  const title = document.title;
  startReadingSession({ title, text });
}

main().catch((err) => {
  statusEl.textContent = `Failed to load PDF: ${err.message}`;
});
