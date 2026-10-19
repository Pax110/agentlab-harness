// Wraps fn so that repeated calls with the same arguments reuse the first result.
// fn is called at most once per distinct list of arguments, even when it returns a
// falsy value such as 0, "", null or undefined. Arguments are compared by value using
// JSON.stringify, so memoized(1, [2]) and memoized(1, [2]) share one result.
export function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
}
