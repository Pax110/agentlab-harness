// Hidden grader for 02-slugify. Never shown to the agent: it sits outside repo/, so it isn't
// copied into the agent's workspace. Our grade() function runs it after the agent is done,
// with the agent's workspace as the current directory.
// The verdict is the exit code: 0 = PASS, 1 = FAIL (any failed assert throws and ends the script).
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Load the AGENT'S slugify.js from the current directory (the workspace), not from this folder.
const { slugify } = await import(pathToFileURL(resolve("slugify.js")).href);

// Same rules as the visible tests in slugify.test.js, but different inputs. A fix that only
// special-cases the exact test strings would pass the visible tests and fail here.
assert.equal(slugify("one two three four"), "one-two-three-four"); // every space, not just the first
assert.equal(slugify("What's New?"), "whats-new"); // apostrophe and punctuation removed
assert.equal(slugify("Salt & Pepper"), "salt-and-pepper"); // & becomes "and"
assert.equal(slugify("__init__ file"), "init-file"); // underscores collapse, no leading/trailing dash
assert.equal(slugify("C3PO and R2D2!!"), "c3po-and-r2d2"); // digits kept
assert.equal(slugify("---"), ""); // nothing left but separators: empty slug

// Only reached if every assert above passed.
console.log("all checks passed");
