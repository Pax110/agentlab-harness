// Converts a duration like "1h30m" or "45s" to a number of seconds.
// Units are h (hours), m (minutes) and s (seconds), in that order, each at most once.
// Throws a SyntaxError for an empty string or anything that doesn't follow these rules.
export function parseDuration(text) {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!match || text === "") throw new SyntaxError(`Invalid duration: ${text}`);
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}
