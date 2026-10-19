import assert from "node:assert/strict";
import { test } from "node:test";
import { capitalize, kebabCase, truncate } from "./textutils.js";

test("truncate", () => {
  assert.equal(truncate("hello world", 5), "hell…");
});

test("other helpers", () => {
  assert.equal(capitalize("hello"), "Hello");
  assert.equal(kebabCase("Hello Big World"), "hello-big-world");
});
