import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDuration } from "./duration.js";

test("minutes", () => {
  assert.equal(parseDuration("2m"), 120);
});

test("hours and minutes", () => {
  assert.equal(parseDuration("1h30m"), 5400);
});
