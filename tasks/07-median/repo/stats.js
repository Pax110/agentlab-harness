// Returns the median of a non-empty array of numbers. Does not modify the input array.
// median([3, 1, 2]) -> 2, median([4, 1, 3, 2]) -> 2.5
export function median(numbers) {
  const sorted = numbers.sort();
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
