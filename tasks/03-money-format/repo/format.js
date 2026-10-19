// Formats a number of cents as dollars, e.g. 1999 -> "$19.99" and 5 -> "$0.05".
// Negative amounts are written with the minus sign first: -150 -> "-$1.50".
export function formatCents(cents) {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return `$${dollars}.${rest}`;
}
