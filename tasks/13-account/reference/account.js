// A bank account. Amounts are whole numbers of cents. The balance can never go below zero.
export class Account {
  constructor(owner) {
    this.owner = owner;
    this.balance = 0;
    this.history = []; // e.g. [["deposit", 100], ["withdraw", 30]]
  }

  // Adds money. Throws a RangeError if amount is not a positive whole number.
  deposit(amount) {
    if (!Number.isInteger(amount) || amount <= 0) throw new RangeError(`invalid amount: ${amount}`);
    this.balance += amount;
    this.history.push(["deposit", amount]);
  }

  // Takes money out. Throws an Error if the balance would go below zero, and then
  // nothing changes.
  withdraw(amount) {
    if (amount > this.balance) throw new Error("insufficient funds");
    this.balance -= amount;
    this.history.push(["withdraw", amount]);
  }

  // Moves money to another account: a withdraw here and a deposit there.
  // If the withdraw fails, neither account changes.
  transfer(amount, other) {
    this.withdraw(amount);
    other.deposit(amount);
  }
}
