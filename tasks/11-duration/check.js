// Hidden grader for 11-duration. Exit code 0 = PASS.
// Seconds and the SyntaxError rule are only in the comment in duration.js.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { parseDuration } = await import(pathToFileURL(resolve("duration.js")).href);
assert.equal(parseDuration("45s"), 45); // seconds
assert.equal(parseDuration("1h2m3s"), 3723);
assert.equal(parseDuration("1h"), 3600);
assert.equal(parseDuration("10m5s"), 605);
assert.throws(() => parseDuration(""), SyntaxError); // empty
assert.throws(() => parseDuration("5x"), SyntaxError); // unknown unit
assert.throws(() => parseDuration("2m1h"), SyntaxError); // wrong order
console.log("all checks passed");
