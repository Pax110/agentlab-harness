import assert from "node:assert/strict";
import { test } from "node:test";
import { median } from "./stats.js";

test("odd length", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([10, 9, 2]), 9);
});
