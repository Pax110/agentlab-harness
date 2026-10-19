// Checks that every task is fair, without calling Claude (free):
//   the buggy repo/ must FAIL its visible tests and the hidden grader, and
//   repo/ with reference/ copied over it must PASS both.
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as log from "../src/shared/log.ts";
import { grade, runTests } from "../src/agent/solve.ts";

// Copy the task's code (optionally with the reference fix on top) into a temporary folder and check it.
function check(taskDir: string, withReference: boolean): { tests: boolean; grader: boolean } {
  const dir = mkdtempSync(join(tmpdir(), "agentlab-validate-"));
  try {
    cpSync(join(taskDir, "repo"), dir, { recursive: true });
    if (withReference) cpSync(join(taskDir, "reference"), dir, { recursive: true });
    return { tests: runTests(dir).startsWith("All tests passed"), grader: grade(taskDir, dir).passed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rows: Record<string, string>[] = [];
let allOk = true;
for (const name of readdirSync("tasks").sort()) {
  const taskDir = resolve("tasks", name);
  const buggy = check(taskDir, false);
  const fixed = check(taskDir, true);
  const ok = !buggy.tests && !buggy.grader && fixed.tests && fixed.grader;
  if (!ok) allOk = false;
  const mark = (passed: boolean) => (passed ? "pass" : "fail");
  rows.push({
    task: name,
    "buggy: tests": mark(buggy.tests),
    "buggy: grader": mark(buggy.grader),
    "fixed: tests": mark(fixed.tests),
    "fixed: grader": mark(fixed.grader),
    valid: ok ? "✓" : "✗",
  });
}

log.header("VALIDATE", "buggy must fail both, fixed must pass both");
log.table(rows);

// Every task must be in exactly one split (train or heldout) in split.json.
const split: Record<string, string[]> = JSON.parse(readFileSync("split.json", "utf8"));
const listed = Object.values(split).flat();
const taskNames = readdirSync("tasks").sort();
const splitProblems = [
  ...taskNames.filter((name) => listed.filter((n) => n === name).length !== 1).map((name) => `${name} is not in exactly one split`),
  ...listed.filter((name) => !taskNames.includes(name)).map((name) => `${name} is in split.json but has no task folder`),
];
if (splitProblems.length > 0) allOk = false;
log.header("SPLIT", Object.entries(split).map(([s, names]) => `${s}: ${names.length}`).join(" · "));
log.line(splitProblems.length === 0 ? "every task is in exactly one split" : splitProblems.join("\n"));

log.verdict(allOk, allOk ? "every task is valid" : "some tasks are broken (see ✗ rows or the split problems)");
process.exitCode = allOk ? 0 : 1;
