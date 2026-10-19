// Hidden grader for 12-top-words. Exit code 0 = PASS.
// Case, punctuation and tie rules are only in the comment in words.js.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { topWords } = await import(pathToFileURL(resolve("words.js")).href);
assert.deepEqual(topWords("The the THE cat", 1), ["the"]); // case-insensitive, lower case out
assert.deepEqual(topWords("cat, cat. dog!", 2), ["cat", "dog"]); // punctuation ignored
assert.deepEqual(topWords("pear apple", 2), ["apple", "pear"]); // ties alphabetical
assert.deepEqual(topWords("a  b   a", 5), ["a", "b"]); // extra spaces, n too large
assert.deepEqual(topWords("", 3), []);
console.log("all checks passed");
