With const add = memoize((a, b) => a + b), calling add(1, 2) and then add(1, 3) returns 3 both times. Fix memoize.js.
