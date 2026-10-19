// Free check of the baseline plumbing, without calling Claude: for every task, write a fake model
// answer that contains the reference fix (in the FILE format, once with a code fence), parse it,
// apply it to a fresh copy of the task, and grade it. Every task must PASS.
//   npx tsx cli/check-offline.ts
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as log from "../src/shared/log.ts";
import { grade } from "../src/agent/solve.ts";
import { applyFiles, parseFiles, readRepo } from "../src/baselines/common.ts";

let allOk = true;
for (const task of readdirSync("tasks").sort()) {
  const taskDir = resolve("tasks", task);
  const dir = mkdtempSync(join(tmpdir(), "agentlab-baseline-"));
  try {
    cpSync(join(taskDir, "repo"), dir, { recursive: true });
    // A fake answer: some reasoning text, then each reference file (the first one wrapped in a code fence).
    const answer = [
      "Reasoning: the bug is ...",
      ...readRepo(join(taskDir, "reference")).map((f, i) => `=== FILE: ${f.path} ===\n${i === 0 ? "```js\n" : ""}${f.content}${i === 0 ? "```\n" : ""}=== END FILE ===`),
    ].join("\n");
    const written = applyFiles(dir, parseFiles(answer));
    const { passed } = grade(taskDir, dir);
    if (!passed) allOk = false;
    log.attempt(task, passed, `parsed and wrote ${written.join(", ")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
log.verdict(allOk, allOk ? "parse → apply → grade works for every task" : "some tasks failed (see FAIL lines)");
process.exitCode = allOk ? 0 : 1;
