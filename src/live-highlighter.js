// Best-effort sentence highlighter: wraps the sentence currently being read in a
// frosted-glass span directly on the live page, so the eye is drawn to it while
// listening. There's no DOM-node backing for `sentences[]` (they come from Readability
// parsing a *cloned* document — see content.js/reader-session.js), so this streams
// forward through the live page's own text nodes and matches each sentence's text
// against them as playback reaches it, instead of trying to reuse any reference from
// extraction. A sentence that can't be located (page text differs from what was
// extracted — e.g. content that changed after load) is simply left unhighlighted;
// audio keeps playing regardless.

const LOOKAHEAD_CAP = 4000; // extra characters of live text scanned per sentence before giving up

const HIGHLIGHT_STYLE =
  "background:rgba(128,128,128,0.16);" +
  "background:color-mix(in srgb, currentColor 16%, transparent);" + // tints toward the page's own text color, so it reads on both light and dark pages without guessing a theme
  "border-radius:5px;" +
  "box-shadow:0 0 0 1px rgba(128,128,128,0.14);" +
  "backdrop-filter:blur(4px) saturate(140%);" +
  "-webkit-backdrop-filter:blur(4px) saturate(140%);" +
  "padding:0.05em 0;" +
  "transition:background 0.15s ease;";

function normalize(str) {
  return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isSkippableParent(el) {
  if (!el) return true;
  const tag = el.tagName;
  return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE";
}

function lastTextDescendant(node) {
  if (node.nodeType === Node.TEXT_NODE) return node;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const found = lastTextDescendant(node.childNodes[i]);
    if (found) return found;
  }
  return null;
}

export class LiveHighlighter {
  constructor(sentences, { root = document.body } = {}) {
    this.sentences = sentences;
    this.root = root;
    this.walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (isSkippableParent(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    this.cursorNode = this.walker.nextNode();
    this.cursorOffset = 0;
    this.lastMatchedIndex = -1;
    this.activeSpan = null;
  }

  // Moves the visible highlight to `index`. Handles both the common case (the very next
  // sentence, as playback advances normally — cheap, just continues the stream) and jumps
  // (voice/speed change, "read from here", skip forward/back) by restarting the walk from
  // the top and silently fast-forwarding through the sentences in between.
  highlightAt(index) {
    if (index === this.lastMatchedIndex || index < 0 || index >= this.sentences.length) return;

    if (index < this.lastMatchedIndex || index > this.lastMatchedIndex + 1) {
      this._resetWalker();
      for (let i = 0; i < index; i++) this._advanceTo(this.sentences[i], true);
    } else {
      this._unwrap();
    }

    this._advanceTo(this.sentences[index], false);
    this.lastMatchedIndex = index;
  }

  clear() {
    this._unwrap();
    this.lastMatchedIndex = -1;
  }

  _resetWalker() {
    this._unwrap();
    this.walker.currentNode = this.root;
    this.cursorNode = this.walker.nextNode();
    this.cursorOffset = 0;
  }

  _unwrap() {
    if (!this.activeSpan) return;
    const span = this.activeSpan;
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    }
    this.activeSpan = null;
  }

  // Streams live text nodes forward from the current cursor, matching `sentenceText`
  // against the normalized concatenation. `silent` fast-forwards the cursor past a
  // match without touching the DOM (used to reposition after a jump); otherwise a
  // successful match gets wrapped in the highlight span.
  _advanceTo(sentenceText, silent) {
    const needle = normalize(sentenceText);
    if (!needle || !this.cursorNode) return;

    // Resync the walker to our logical cursor in case a prior failed search (which
    // still calls walker.nextNode() while scanning) left it further ahead than that.
    this.walker.currentNode = this.cursorNode;

    let normalized = "";
    const map = []; // map[i] -> { node, offset } that produced normalized[i]
    let node = this.cursorNode;
    let offset = this.cursorOffset;
    let lastWasSpace = true;

    while (node && normalized.length < needle.length + LOOKAHEAD_CAP) {
      const text = node.nodeValue;
      for (; offset < text.length; offset++) {
        const ch = text[offset];
        if (/\s/.test(ch)) {
          if (!lastWasSpace) {
            normalized += " ";
            map.push({ node, offset });
            lastWasSpace = true;
          }
        } else {
          normalized += ch.toLowerCase();
          map.push({ node, offset });
          lastWasSpace = false;
        }
      }

      const pos = normalized.indexOf(needle);
      if (pos !== -1) {
        if (silent) this._commitSilent(map, pos, needle.length);
        else this._commitHighlight(map, pos, needle.length);
        return;
      }

      node = this.walker.nextNode();
      offset = 0;
    }
    // Not found within the lookahead window — leave unhighlighted, cursor untouched,
    // so the next sentence still gets a fair search from roughly the same place.
  }

  _commitSilent(map, pos, len) {
    const end = map[pos + len - 1];
    if (!end) return;
    this.cursorNode = end.node;
    this.cursorOffset = end.offset + 1;
    if (this.cursorOffset >= this.cursorNode.nodeValue.length) {
      this.walker.currentNode = this.cursorNode;
      this.cursorNode = this.walker.nextNode();
      this.cursorOffset = 0;
    }
  }

  _commitHighlight(map, pos, len) {
    const start = map[pos];
    const end = map[pos + len - 1];
    if (!start || !end) return;

    const range = document.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset + 1);
    } catch {
      return; // page mutated under us mid-scan — skip this sentence, keep listening
    }
    if (range.collapsed) return;

    const span = document.createElement("span");
    span.style.cssText = HIGHLIGHT_STYLE;
    try {
      range.surroundContents(span);
    } catch {
      // Range crosses element boundaries surroundContents() can't wrap in one shot
      // (e.g. the sentence spans an inline <em>/<a>) — extract and rewrap manually.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    this.activeSpan = span;
    span.scrollIntoView({ behavior: "smooth", block: "center" });

    // Resume the stream from wherever comes after the span now sits in the DOM
    // (splitting/rewrapping moved things around, so the pre-mutation map offsets
    // are no longer trustworthy for this).
    const anchor = lastTextDescendant(span) || span;
    this.walker.currentNode = anchor;
    this.cursorNode = this.walker.nextNode();
    this.cursorOffset = 0;
  }
}
