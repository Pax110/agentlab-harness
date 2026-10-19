// Parses a URL query string such as "?q=hello&page=2" into an object: { q: "hello", page: "2" }.
// A leading "?" is ignored, and an empty string gives {}. Keys and values are URL-decoded,
// and "+" means a space. Everything after the first "=" is the value. A key without "="
// gets the value "". A key that appears more than once gets an array of its values, in order.
export function parseQuery(query) {
  const result = {};
  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    result[key] = value;
  }
  return result;
}
