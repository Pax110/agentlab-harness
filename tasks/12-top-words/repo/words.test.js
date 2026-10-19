import assert from "node:assert/strict";
import { test } from "node:test";
import { topWords } from "./words.js";

test("most frequent first", () => {
  assert.deepEqual(topWords("b a b", 1), ["b"]);
  assert.deepEqual(topWords("x y y z z z", 2), ["z", "y"]);
});
