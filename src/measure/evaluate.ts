// Scoring one harness version: run it on the tasks of the chosen splits, k attempts each.
// Used by run.ts (tables for you) and evolve.ts (Phase 4 decisions).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { HarnessConfig } from "../agent/harness.ts";
import * as log from "../shared/log.ts";
import { solve, type RunResult } from "../agent/solve.ts";

/** Training tasks (Phase 4 learns from their failures) and held-out tasks (only used to judge). */
export type Split = "train" | "heldout";

export function loadSplit(): Record<Split, string[]> {
  return JSON.parse(readFileSync("split.json", "utf8"));
}

/** One attempt, with the split its task belongs to. */
export interface Attempt extends RunResult {
  split: Split;
}

/**
 * Run `config` on every task of `splits`, k attempts each. Stops if `budget` dollars would be exceeded.
 * `onlyTasks` limits the run to those task names (e.g. to measure newly added tasks).
 */
export async function evaluate(config: HarnessConfig, splits: Split[], k: number, budget = Infinity, onlyTasks?: string[]): Promise<Attempt[]> {
  const split = loadSplit();
  const attempts: Attempt[] = [];
  let spent = 0;
  for (const s of splits) {
    for (const name of split[s]) {
      if (onlyTasks && !onlyTasks.includes(name)) continue;
      for (let i = 1; i <= k; i++) {
        if (spent >= budget) throw new Error(`Budget of $${budget.toFixed(2)} reached while evaluating ${config.name}`);
        log.setQuiet(true); // hide the turn-by-turn output; agent.ts shows it for single runs
        let result: RunResult;
        try {
          result = await solve(resolve("tasks", name), config);
        } finally {
          log.setQuiet(false);
        }
        spent += result.cost;
        attempts.push({ ...result, split: s });
        log.attempt(`${s} · ${name} · ${config.name} · #${i}`, result.passed, `${result.turns} turns · $${result.cost.toFixed(4)} · ${result.seconds.toFixed(1)}s`);
      }
    }
  }
  return attempts;
}

/** One attempt as saved in results.json: just what decisions and evidence need. */
export interface ResultRow {
  split: Split;
  task: string;
  harness: string;
  passed: boolean;
  turns: number;
  cost: number;
  attemptDir: string; // runs/<task>-<time>/ with trace.jsonl and summary.md
}

export function toRows(attempts: Attempt[]): ResultRow[] {
  return attempts.map((a) => ({ split: a.split, task: a.task, harness: a.harness, passed: a.passed, turns: a.turns, cost: a.cost, attemptDir: dirname(a.tracePath) }));
}

export function loadResults(path: string): ResultRow[] {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Passes, number of attempts and average cost for one split. */
export function score(attempts: { split: Split; passed: boolean; cost: number }[], split: Split): { passes: number; total: number; avgCost: number } {
  const inSplit = attempts.filter((a) => a.split === split);
  const cost = inSplit.reduce((total, a) => total + a.cost, 0);
  return { passes: inSplit.filter((a) => a.passed).length, total: inSplit.length, avgCost: inSplit.length > 0 ? cost / inSplit.length : 0 };
}

/** Save the attempts (without the full conversations) so evidence.ts can find their traces. */
export function saveResults(attempts: Attempt[] | ResultRow[], path: string): void {
  const rows = attempts.map((a) => ("tracePath" in a ? toRows([a])[0]! : a));
  writeFileSync(path, JSON.stringify(rows, null, 2) + "\n");
}
