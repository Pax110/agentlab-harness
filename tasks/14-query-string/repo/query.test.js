import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuery } from "./query.js";

test("leading question mark", () => {
  assert.deepEqual(parseQuery("?q=hello"), { q: "hello" });
});

test("several keys", () => {
  assert.deepEqual(parseQuery("a=1&b=2"), { a: "1", b: "2" });
});
