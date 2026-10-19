import { formatCents } from "./format.js";

// One line per item ("<name>: <price>"), then a total line.
export function report(items) {
  const lines = items.map((item) => `${item.name}: ${formatCents(item.cents)}`);
  const total = items.reduce((sum, item) => sum + item.cents, 0);
  lines.push(`Total: ${formatCents(total)}`);
  return lines.join("\n");
}
