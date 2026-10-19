import assert from "node:assert/strict";
import { test } from "node:test";
import { memoize } from "./memoize.js";

test("different arguments give different results", () => {
  const add = memoize((a, b) => a + b);
  assert.equal(add(1, 2), 3);
  assert.equal(add(1, 3), 4);
});
