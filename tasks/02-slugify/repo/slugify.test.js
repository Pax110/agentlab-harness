// Tests for slugify.js, written with Node's built-in test runner.
// Run them with `node --test`: it finds every *.test.js file and runs each test(...) in it.
// Each test(name, fn) passes if fn finishes and fails if any assert inside it throws.
// assert.equal(actual, expected) throws when the two differ (=== comparison).
import assert from "node:assert/strict";
import { test } from "node:test";

// The code under test.
import { slugify } from "./slugify.js";

test("spaces become dashes", () => {
  assert.equal(slugify("a b c"), "a-b-c");
});

test("punctuation is removed", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("Don't Panic"), "dont-panic");
});

test("& becomes 'and'", () => {
  assert.equal(slugify("Tom & Jerry"), "tom-and-jerry");
});

test("underscores and repeated separators collapse to one dash", () => {
  assert.equal(slugify("snake_case  --  title"), "snake-case-title");
});

test("no leading or trailing dashes; digits are kept", () => {
  assert.equal(slugify("  -Route 66- "), "route-66");
});
