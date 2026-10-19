// Parses a URL query string such as "?q=hello&page=2" into an object: { q: "hello", page: "2" }.
// A leading "?" is ignored, and an empty string gives {}. Keys and values are URL-decoded,
// and "+" means a space. Everything after the first "=" is the value. A key without "="
// gets the value "". A key that appears more than once gets an array of its values, in order.
export function parseQuery(query) {
  const result = {};
  const text = query.startsWith("?") ? query.slice(1) : query;
  if (text === "") return result;
  const decode = (s) => decodeURIComponent(s.replace(/\+/g, " "));
  for (const pair of text.split("&")) {
    const eq = pair.indexOf("=");
    const key = decode(eq === -1 ? pair : pair.slice(0, eq));
    const value = decode(eq === -1 ? "" : pair.slice(eq + 1));
    if (Object.hasOwn(result, key)) result[key] = [].concat(result[key], value);
    else result[key] = value;
  }
  return result;
}
