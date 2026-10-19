import assert from "node:assert/strict";
import { test } from "node:test";
import { chunk } from "./chunk.js";

test("splits into groups", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
