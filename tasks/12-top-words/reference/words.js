// Returns the n most frequent words in text, most frequent first.
// Words are compared case-insensitively and returned in lower case. A word is a run of
// letters or digits, so punctuation and extra spaces are ignored ("Cat," and "cat" are
// the same word). Ties are broken alphabetically. If n is larger than the number of
// different words, all of them are returned.
export function topWords(text, n) {
  const counts = new Map();
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))
    .slice(0, n);
}
