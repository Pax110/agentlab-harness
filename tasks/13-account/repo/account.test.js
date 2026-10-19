import assert from "node:assert/strict";
import { test } from "node:test";
import { Account } from "./account.js";

test("history records withdrawals", () => {
  const acc = new Account("ada");
  acc.deposit(100);
  acc.withdraw(30);
  assert.deepEqual(acc.history.at(-1), ["withdraw", 30]);
  assert.equal(acc.balance, 70);
});
