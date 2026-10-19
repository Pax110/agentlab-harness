// Turns a title into a URL slug, e.g. "Hello World" -> "hello-world".
export function slugify(title) {
  return title.trim().toLowerCase().replace(" ", "-");
}
