// Hidden grader for 04-textutils. Exit code 0 = PASS.
// Checks truncate, and that every other helper still works after the agent rewrote the file.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const t = await import(pathToFileURL(resolve("textutils.js")).href);
assert.equal(t.truncate("hello world", 5), "hell…");
assert.equal(t.truncate("hello", 5), "hello"); // exactly max: unchanged
assert.equal(t.truncate("hi", 5), "hi");
assert.equal(t.truncate("abcdef", 1), "…");
// The rest of the file must still work.
assert.equal(t.titleCase("the quick brown fox"), "The Quick Brown Fox");
assert.equal(t.camelCase("snake_case-mixed words"), "snakeCaseMixedWords");
assert.equal(t.snakeCase("Hello Big World"), "hello_big_world");
assert.equal(t.isPalindrome("A man, a plan, a canal: Panama"), true);
assert.equal(t.countWords("  two   words "), 2);
assert.equal(t.countVowels("Hello World"), 3);
assert.equal(t.padLeft("7", 3, "0"), "007");
assert.equal(t.stripHtml("<p>Hello <b>you</b></p>"), "Hello you");
assert.equal(t.escapeHtml(`<a href="x">Tom & Jerry's</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
assert.equal(t.unescapeHtml("&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;"), "<b>Tom & Jerry</b>");
assert.equal(t.initials("  grace   brewster hopper "), "GBH");
assert.equal(t.collapseSpaces("  a   b \n c "), "a b c");
assert.equal(t.wordWrap("the quick brown fox", 10), "the quick\nbrown fox");
assert.equal(t.removeAccents("Crème Brûlée"), "Creme Brulee");
assert.equal(t.longestWord("a bb ccc dd"), "ccc");
assert.deepEqual(t.charFrequency("a b a"), { a: 2, b: 1 });
assert.equal(t.mask("1234567890"), "******7890");
assert.equal(t.mask("123"), "123");
console.log("all checks passed");
