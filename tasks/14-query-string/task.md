parseQuery("?q=hello") returns { "?q": "hello" } instead of { q: "hello" }. Fix query.js.
