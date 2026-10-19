import assert from "node:assert/strict";
import { test } from "node:test";
import { report } from "./report.js";
import { formatCents } from "./format.js";

test("report lists items and a total", () => {
  assert.equal(report([{ name: "Tea", cents: 305 }]), "Tea: $3.05\nTotal: $3.05");
});

test("formatCents shows two decimals", () => {
  assert.equal(formatCents(1999), "$19.99");
});
