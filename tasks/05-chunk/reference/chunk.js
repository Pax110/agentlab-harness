// Splits an array into groups of `size` items. The last group may be shorter.
// chunk([1, 2, 3, 4, 5], 2) -> [[1, 2], [3, 4], [5]]
// Throws a RangeError if size is not a positive integer.
export function chunk(items, size) {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("size must be a positive integer");
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}
