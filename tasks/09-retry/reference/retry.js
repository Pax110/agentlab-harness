// Calls the async function fn until it succeeds, up to `times` calls in total.
// Resolves with fn's result on the first success. If every call fails, rejects with
// the error from the LAST call. Waits `delayMs` milliseconds between calls (default 0).
export async function retry(fn, times, delayMs = 0) {
  let lastError;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
