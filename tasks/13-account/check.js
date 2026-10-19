// Hidden grader for 13-account. Exit code 0 = PASS.
// The overdraft, RangeError and transfer rules are only in the comments in account.js.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Account } = await import(pathToFileURL(resolve("account.js")).href);

const a = new Account("ada");
a.deposit(50);
a.withdraw(20);
assert.deepEqual(a.history, [["deposit", 50], ["withdraw", 20]]);

assert.throws(() => a.withdraw(100), Error); // would go below zero
assert.equal(a.balance, 30); // ...and nothing changed
assert.equal(a.history.length, 2);

assert.throws(() => a.deposit(-5), RangeError); // not positive
assert.throws(() => a.deposit(1.5), RangeError); // not whole
assert.equal(a.balance, 30);

const b = new Account("bob");
assert.throws(() => a.transfer(500, b), Error); // withdraw fails
assert.equal(a.balance, 30); // neither account changed
assert.equal(b.balance, 0);

a.transfer(10, b);
assert.equal(a.balance, 20);
assert.equal(b.balance, 10);
console.log("all checks passed");
