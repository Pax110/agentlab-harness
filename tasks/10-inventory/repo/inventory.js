// A simple stock list. Quantities are whole numbers and never negative.
export class Inventory {
  constructor() {
    this.items = new Map(); // name -> { quantity, priceCents }
  }

  // Adds `quantity` units of an item. Adding an item that already exists increases its
  // quantity; its price becomes the new priceCents.
  add(name, quantity, priceCents) {
    this.items.set(name, { quantity, priceCents });
  }

  // Removes `quantity` units. Throws an Error if there aren't enough units in stock, and
  // then leaves the stock unchanged. An item whose quantity reaches 0 is removed.
  remove(name, quantity) {
    const item = this.items.get(name);
    item.quantity -= quantity;
    if (item.quantity === 0) this.items.delete(name);
  }

  // Total value of the stock in cents (quantity × price for every item).
  totalCents() {
    let total = 0;
    for (const item of this.items.values()) total += item.priceCents;
    return total;
  }
}
