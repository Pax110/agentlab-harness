// Formats a number of cents as dollars, e.g. 1999 -> "$19.99" and 5 -> "$0.05".
// Negative amounts are written with the minus sign first: -150 -> "-$1.50".
export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
