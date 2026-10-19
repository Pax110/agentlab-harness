// Tests for sum.js, written with Node's built-in test runner.
// Run them with `node --test`: it finds every *.test.js file and runs each test(...) in it.

// assert.equal(actual, expected) does nothing if the two are equal and throws an error if not.
// "strict" means === comparison, so 6 and "6" are NOT equal.
import assert from "node:assert/strict";
import { test } from "node:test";

// The code under test.
import { sum } from "./sum.js";

// test(name, fn) registers one test. If fn throws, the test fails; otherwise it passes.
test("adds all numbers", () => {
  assert.equal(sum([1, 2, 3]), 6);
});
