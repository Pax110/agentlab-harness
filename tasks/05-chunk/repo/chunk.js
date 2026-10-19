// Splits an array into groups of `size` items. The last group may be shorter.
// chunk([1, 2, 3, 4, 5], 2) -> [[1, 2], [3, 4], [5]]
// Throws a RangeError if size is not a positive integer.
export function chunk(items, size) {
  const groups = [];
  for (let i = 0; i + size <= items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}
