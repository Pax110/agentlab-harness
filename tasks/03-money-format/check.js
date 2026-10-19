// Hidden grader for 03-money-format. Exit code 0 = PASS.
// The rules come from the comment in format.js; the negative case is never in the visible tests.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { formatCents } = await import(pathToFileURL(resolve("format.js")).href);
const { report } = await import(pathToFileURL(resolve("report.js")).href);
assert.equal(formatCents(5), "$0.05"); // one-digit cents padded
assert.equal(formatCents(100), "$1.00"); // zero cents
assert.equal(formatCents(0), "$0.00");
assert.equal(formatCents(-150), "-$1.50"); // negative: minus sign first
assert.equal(report([{ name: "Pen", cents: 250 }, { name: "Refund", cents: -300 }]), "Pen: $2.50\nRefund: -$3.00\nTotal: -$0.50");
console.log("all checks passed");
