// Turns a title into a URL slug, e.g. "Hello World" -> "hello-world".
export function slugify(title) {
  return title.toLowerCase().replace(/&/g, " and ").replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
