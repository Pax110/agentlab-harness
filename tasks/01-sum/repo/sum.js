// Returns the sum of an array of numbers.
export function sum(numbers) {
  let total = 0;
  for (let i = 1; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}
