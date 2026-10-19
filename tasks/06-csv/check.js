// Hidden grader for 06-csv. Exit code 0 = PASS.
// Escaped quotes ("") are described in the comment in csv.js but never in the visible tests.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { parseLine } = await import(pathToFileURL(resolve("csv.js")).href);
assert.deepEqual(parseLine("plain"), ["plain"]);
assert.deepEqual(parseLine('"a,b"'), ["a,b"]);
assert.deepEqual(parseLine('"say ""hi""",2'), ['say "hi"', "2"]); // escaped quotes
assert.deepEqual(parseLine("a,"), ["a", ""]); // trailing empty field
assert.deepEqual(parseLine('""'), [""]); // quoted empty field
assert.deepEqual(parseLine('1,"x, ""y"", z",3'), ["1", 'x, "y", z', "3"]);
console.log("all checks passed");
