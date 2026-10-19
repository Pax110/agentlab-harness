import assert from "node:assert/strict";
import { test } from "node:test";
import { Inventory } from "./inventory.js";

test("adding an existing item increases its quantity", () => {
  const inv = new Inventory();
  inv.add("pen", 2, 100);
  inv.add("pen", 3, 100);
  assert.equal(inv.items.get("pen").quantity, 5);
});

test("total value", () => {
  const inv = new Inventory();
  inv.add("pen", 2, 100);
  inv.add("cup", 1, 450);
  assert.equal(inv.totalCents(), 650);
});
