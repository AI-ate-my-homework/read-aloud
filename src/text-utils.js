const MAX_CHUNK_LEN = 300;

export function splitIntoSentences(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const rough = clean.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [clean];

  const sentences = [];
  for (const s of rough) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length <= MAX_CHUNK_LEN) {
      sentences.push(trimmed);
      continue;
    }
    // Very long "sentence" (no punctuation, e.g. a run-on line) — split on commas/whitespace
    // so no single TTS call is fed an unbounded string.
    let rest = trimmed;
    while (rest.length > MAX_CHUNK_LEN) {
      let cut = rest.lastIndexOf(",", MAX_CHUNK_LEN);
      if (cut < MAX_CHUNK_LEN * 0.4) cut = rest.lastIndexOf(" ", MAX_CHUNK_LEN);
      if (cut <= 0) cut = MAX_CHUNK_LEN;
      sentences.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) sentences.push(rest);
  }
  return sentences;
}
