retry gives up after the first failure: retry(flaky, 3) rejects even though flaky succeeds on its 2nd call. Fix retry.js.
