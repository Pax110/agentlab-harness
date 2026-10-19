import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLine } from "./csv.js";

test("quoted field with a comma", () => {
  assert.deepEqual(parseLine('a,"b,c",d'), ["a", "b,c", "d"]);
});

test("empty field", () => {
  assert.deepEqual(parseLine("x,,y"), ["x", "", "y"]);
});
