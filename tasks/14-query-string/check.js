// Hidden grader for 14-query-string. Exit code 0 = PASS.
// Decoding, "+", repeated keys and keys without "=" are only in the comment in query.js.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { parseQuery } = await import(pathToFileURL(resolve("query.js")).href);
assert.deepEqual(parseQuery(""), {});
assert.deepEqual(parseQuery("?"), {});
assert.deepEqual(parseQuery("name=John+Smith"), { name: "John Smith" }); // + is a space
assert.deepEqual(parseQuery("x=%41%42&y%20z=1"), { x: "AB", "y z": "1" }); // URL-decoded
assert.deepEqual(parseQuery("t=1&t=2&t=3"), { t: ["1", "2", "3"] }); // repeated key
assert.deepEqual(parseQuery("flag&a=1"), { flag: "", a: "1" }); // key without "="
assert.deepEqual(parseQuery("eq=a=b"), { eq: "a=b" }); // value after the first "="
console.log("all checks passed");
