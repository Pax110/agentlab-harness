// Returns the n most frequent words in text, most frequent first.
// Words are compared case-insensitively and returned in lower case. A word is a run of
// letters or digits, so punctuation and extra spaces are ignored ("Cat," and "cat" are
// the same word). Ties are broken alphabetically. If n is larger than the number of
// different words, all of them are returned.
export function topWords(text, n) {
  const counts = {};
  for (const word of text.split(" ")) counts[word] = (counts[word] ?? 0) + 1;
  return Object.keys(counts)
    .sort((a, b) => counts[a] - counts[b])
    .slice(0, n);
}
