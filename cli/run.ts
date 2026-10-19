// Run every task × every harness version × k attempts, then print a comparison table, per split.
//   npx tsx --env-file=.env.local cli/run.ts 3                                            (harnesses/v1.json, both splits)
//   npx tsx --env-file=.env.local cli/run.ts 3 harnesses/v1.json harnesses/no-run-tests.json  (compare two versions)
//   npx tsx --env-file=.env.local cli/run.ts 3 harnesses/v1.json heldout                    (one split only)
//   npx tsx --env-file=.env.local cli/run.ts 3 harnesses/v3.json 11-duration 12-top-words   (only these tasks)
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { evaluate, loadSplit, saveResults, score, type Attempt, type Split } from "../src/measure/evaluate.ts";
import { loadConfig } from "../src/agent/harness.ts";
import * as log from "../src/shared/log.ts";

const k = Number(process.argv[2] ?? 1); // attempts per task per harness version
const args = process.argv.slice(3); // harness files (*.json), "train"/"heldout", and/or task names

const split = loadSplit();
const allTasks = [...split.train, ...split.heldout];
const onlySplits = args.filter((a) => a === "train" || a === "heldout") as Split[];
const onlyTasks = args.filter((a) => allTasks.includes(a));
for (const a of args) if (!a.endsWith(".json") && a !== "train" && a !== "heldout" && !allTasks.includes(a)) throw new Error(`Unknown argument: ${a} (use a harness .json file, train, heldout or a task name)`);
const splits: Split[] = onlySplits.length > 0 ? onlySplits : ["train", "heldout"];
const taskFilter = onlyTasks.length > 0 ? onlyTasks : undefined;
const inRun = (task: string) => !taskFilter || taskFilter.includes(task);

// The harness versions to compare: the same model with different settings.
const configPaths = args.filter((a) => a.endsWith(".json"));
const harnesses = (configPaths.length > 0 ? configPaths : ["harnesses/v1.json"]).map(loadConfig);

const taskCount = splits.reduce((n, s) => n + split[s].filter(inRun).length, 0);
log.header("RUN", `${splits.join(" + ")} · ${taskCount} tasks × ${harnesses.length} harness versions (${harnesses.map((c) => c.name).join(", ")}) × ${k} attempts = ${taskCount * harnesses.length * k} runs`);

const all: Attempt[] = [];
for (const harness of harnesses) all.push(...(await evaluate(harness, splits, k, Infinity, taskFilter)));

const average = (list: Attempt[], pick: (a: Attempt) => number): number => list.reduce((total, a) => total + pick(a), 0) / list.length;

// One row per split × task × harness version.
const rows: Record<string, string>[] = [];
for (const s of splits) {
  for (const task of split[s].filter(inRun)) {
    for (const harness of harnesses) {
      const list = all.filter((a) => a.split === s && a.task === task && a.harness === harness.name);
      rows.push({
        split: s,
        task,
        harness: harness.name,
        passed: `${list.filter((a) => a.passed).length}/${list.length}`,
        "avg turns": average(list, (a) => a.turns).toFixed(1),
        "avg run_tests calls": average(list, (a) => a.runTestsCalls).toFixed(1),
        "avg $": average(list, (a) => a.cost).toFixed(4),
        "avg s": average(list, (a) => a.seconds).toFixed(1),
      });
    }
  }
}
log.header("RESULTS", "per task");
log.table(rows);

// The numbers Phase 4 compares: passes per split and harness version, and the cost.
const summary = splits.flatMap((s) =>
  harnesses.map((harness) => {
    const sc = score(all.filter((a) => a.harness === harness.name), s);
    return { split: s, harness: harness.name, passed: `${sc.passes}/${sc.total}`, "avg $": sc.avgCost.toFixed(4) };
  }),
);
log.header("SUMMARY", "per split and harness version");
log.table(summary);
log.header("TOTAL", `$${all.reduce((total, a) => total + a.cost, 0).toFixed(4)}`);

// Save the list of attempts, and say how to get the failure report for this run.
const runDir = resolve("runs", `run-${Date.now()}`);
mkdirSync(runDir, { recursive: true });
const resultsPath = join(runDir, "results.json");
saveResults(all, resultsPath);
log.file("results", resultsPath);
log.line(`failure report: npx tsx cli/evidence.ts ${relative(".", runDir)}`);
