// Small text helpers used across the app.
// Every function takes a string and returns a new value; none of them modify their input.

/**
 * Upper-cases the first character and leaves the rest unchanged.
 * capitalize("hello world") -> "Hello world"
 * capitalize("") -> ""
 */
export function capitalize(text) {
  if (text === "") return "";
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * Capitalizes every word. Words are separated by single spaces.
 * titleCase("the quick brown fox") -> "The Quick Brown Fox"
 */
export function titleCase(text) {
  return text.split(" ").map(capitalize).join(" ");
}

/**
 * Converts words separated by spaces, dashes or underscores to camelCase.
 * camelCase("hello big world") -> "helloBigWorld"
 * camelCase("snake_case-mixed words") -> "snakeCaseMixedWords"
 */
export function camelCase(text) {
  const words = text.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  return words.map((word, i) => (i === 0 ? word : capitalize(word))).join("");
}

/**
 * Converts words separated by spaces, dashes or underscores to kebab-case.
 * kebabCase("Hello Big World") -> "hello-big-world"
 */
export function kebabCase(text) {
  return text.toLowerCase().split(/[\s_-]+/).filter(Boolean).join("-");
}

/**
 * Converts words separated by spaces, dashes or underscores to snake_case.
 * snakeCase("Hello Big World") -> "hello_big_world"
 */
export function snakeCase(text) {
  return text.toLowerCase().split(/[\s_-]+/).filter(Boolean).join("_");
}

/**
 * Reverses the characters of the text.
 * reverse("abc") -> "cba"
 */
export function reverse(text) {
  return [...text].reverse().join("");
}

/**
 * True if the text reads the same backwards, ignoring case, spaces and punctuation.
 * isPalindrome("A man, a plan, a canal: Panama") -> true
 * isPalindrome("hello") -> false
 */
export function isPalindrome(text) {
  const letters = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return letters === reverse(letters);
}

/**
 * Counts the words, where words are separated by any amount of whitespace.
 * countWords("  two   words ") -> 2
 * countWords("") -> 0
 */
export function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Counts the vowels a, e, i, o and u, in any case.
 * countVowels("Hello World") -> 3
 */
export function countVowels(text) {
  return (text.match(/[aeiou]/gi) ?? []).length;
}

/**
 * Shortens text to at most `max` characters. If the text is longer than max, it is cut
 * and ends with "…" so that the result is exactly max characters long. Text that
 * already fits (length <= max) is returned unchanged.
 * truncate("hello world", 5) -> "hell…"
 * truncate("hello", 5) -> "hello"
 */
export function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/**
 * Pads the start of the text with `char` until it is `width` characters long.
 * padLeft("7", 3, "0") -> "007"
 */
export function padLeft(text, width, char = " ") {
  return text.padStart(width, char);
}

/**
 * Pads the end of the text with `char` until it is `width` characters long.
 * padRight("ab", 4, ".") -> "ab.."
 */
export function padRight(text, width, char = " ") {
  return text.padEnd(width, char);
}

/**
 * Removes HTML tags and keeps the text between them.
 * stripHtml("<p>Hello <b>you</b></p>") -> "Hello you"
 */
export function stripHtml(text) {
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Escapes the five HTML special characters.
 * escapeHtml('<a href="x">Tom & Jerry\'s</a>') -> "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reverses escapeHtml.
 * unescapeHtml("Tom &amp; Jerry") -> "Tom & Jerry"
 */
export function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * The first letter of every word, upper-cased.
 * initials("Ada Lovelace") -> "AL"
 * initials("  grace   brewster hopper ") -> "GBH"
 */
export function initials(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * Trims the text and replaces every run of whitespace with a single space.
 * collapseSpaces("  a   b \n c ") -> "a b c"
 */
export function collapseSpaces(text) {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Breaks text into lines of at most `width` characters, without splitting words.
 * A word longer than width goes on its own line. Lines are joined with "\n".
 * wordWrap("the quick brown fox", 10) -> "the quick\nbrown fox"
 */
export function wordWrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line === "") line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines.join("\n");
}

/**
 * Removes accents from letters.
 * removeAccents("Crème Brûlée") -> "Creme Brulee"
 */
export function removeAccents(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * The longest word; the first one wins when there is a tie.
 * longestWord("a bb ccc dd") -> "ccc"
 */
export function longestWord(text) {
  let longest = "";
  for (const word of text.split(/\s+/)) if (word.length > longest.length) longest = word;
  return longest;
}

/**
 * Counts how often each character appears, ignoring whitespace.
 * charFrequency("a b a") -> { a: 2, b: 1 }
 */
export function charFrequency(text) {
  const counts = {};
  for (const ch of text.replace(/\s/g, "")) counts[ch] = (counts[ch] ?? 0) + 1;
  return counts;
}

/**
 * Hides all but the last `visible` characters behind `char`.
 * mask("1234567890") -> "******7890"
 * mask("123") -> "123"
 */
export function mask(text, visible = 4, char = "*") {
  if (text.length <= visible) return text;
  return char.repeat(text.length - visible) + text.slice(-visible);
}
