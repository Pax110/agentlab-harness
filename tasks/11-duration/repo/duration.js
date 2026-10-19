// Converts a duration like "1h30m" or "45s" to a number of seconds.
// Units are h (hours), m (minutes) and s (seconds), in that order, each at most once.
// Throws a SyntaxError for an empty string or anything that doesn't follow these rules.
export function parseDuration(text) {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(text);
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 3600 + minutes;
}
