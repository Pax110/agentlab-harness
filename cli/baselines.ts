// Run a baseline method on the tasks, k attempts each, and print a table per split.
// Same tasks, split and hidden graders as Phases 3–4, so the numbers can be compared with run.ts.
//   npx tsx --env-file=.env.local cli/baselines.ts p1-zero-shot 3
//   npx tsx --env-file=.env.local cli/baselines.ts p2-agentless 3 heldout
//   npx tsx --env-file=.env.local cli/baselines.ts p1-cot 1 03-money-format
// Methods: p1-zero-shot · p1-few-shot · p1-cot · p1-self-consistency · p2-agentless
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadSplit, type Split } from "../src/measure/evaluate.ts";
import * as log from "../src/shared/log.ts";
import type { BaselineResult } from "../src/baselines/common.ts";
import { solvePhase1, type Phase1Variant } from "../src/baselines/phase1.ts";
import { solvePhase2 } from "../src/baselines/phase2.ts";

const METHODS = ["p1-zero-shot", "p1-few-shot", "p1-cot", "p1-self-consistency", "p2-agentless"];
const method = process.argv[2] ?? "";
if (!METHODS.includes(method)) throw new Error(`Unknown method "${method}". Use one of: ${METHODS.join(", ")}`);
const k = Number(process.argv[3] ?? 1);
const args = process.argv.slice(4);

const split = loadSplit();
const allTasks = [...split.train, ...split.heldout];
for (const a of args) if (a !== "train" && a !== "heldout" && !allTasks.includes(a)) throw new Error(`Unknown argument: ${a}`);
const onlySplits = args.filter((a) => a === "train" || a === "heldout") as Split[];
const onlyTasks = args.filter((a) => allTasks.includes(a));
const splits: Split[] = onlySplits.length > 0 ? onlySplits : ["train", "heldout"];

const solve = (taskDir: string): Promise<BaselineResult> =>
  method === "p2-agentless" ? solvePhase2(taskDir) : solvePhase1(taskDir, method.slice(3) as Phase1Variant);

log.header("BASELINE", `${method} · ${splits.join(" + ")} · k=${k}`);
const rows: (BaselineResult & { split: Split })[] = [];
for (const s of splits) {
  for (const task of split[s]) {
    if (onlyTasks.length > 0 && !onlyTasks.includes(task)) continue;
    for (let i = 1; i <= k; i++) {
      const result = await solve(resolve("tasks", task));
      rows.push({ ...result, split: s });
      log.attempt(`${s} · ${task} · ${method} · #${i}`, result.passed, `${result.calls} calls · $${result.cost.toFixed(4)} · ${result.seconds.toFixed(1)}s`);
    }
  }
}

const summary = splits.map((s) => {
  const list = rows.filter((r) => r.split === s);
  const cost = list.reduce((total, r) => total + r.cost, 0);
  return { split: s, method, passed: `${list.filter((r) => r.passed).length}/${list.length}`, "avg $": (list.length > 0 ? cost / list.length : 0).toFixed(4) };
});
log.header("SUMMARY", "per split");
log.table(summary);

// Saved in the same shape as run.ts's results.json (harness = the method, turns = Claude calls).
const runDir = resolve("runs", `baseline-${method}-${Date.now()}`);
mkdirSync(runDir, { recursive: true });
const resultsPath = join(runDir, "results.json");
const saved = rows.map((r) => ({ split: r.split, task: r.task, harness: r.method, passed: r.passed, turns: r.calls, cost: r.cost, attemptDir: r.attemptDir }));
writeFileSync(resultsPath, JSON.stringify(saved, null, 2) + "\n");
log.header("TOTAL", `$${rows.reduce((total, r) => total + r.cost, 0).toFixed(4)}`);
log.file("results", resultsPath);
