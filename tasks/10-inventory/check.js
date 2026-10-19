// Hidden grader for 10-inventory. Exit code 0 = PASS.
// The remove() rules are only in the comments in inventory.js, not in the visible tests.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Inventory } = await import(pathToFileURL(resolve("inventory.js")).href);

const inv = new Inventory();
inv.add("pen", 2, 100);
inv.add("pen", 3, 120);
assert.equal(inv.items.get("pen").quantity, 5); // quantities add up
assert.equal(inv.items.get("pen").priceCents, 120); // price updated
assert.equal(inv.totalCents(), 600); // quantity × price

assert.throws(() => inv.remove("pen", 6), Error); // not enough stock
assert.equal(inv.items.get("pen").quantity, 5); // ...and stock unchanged
assert.throws(() => inv.remove("ghost", 1), Error); // unknown item

inv.remove("pen", 5);
assert.equal(inv.items.has("pen"), false); // removed at 0
assert.equal(inv.totalCents(), 0);
console.log("all checks passed");
