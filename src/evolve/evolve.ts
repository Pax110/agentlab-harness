// A Phase 4 evolve run: several rounds. Each round learns from the current best harness's TRAIN
// failures, gets ONE candidate change, scores it on train + held-out, and keeps it only if all
// 3 checks pass. The next round starts from the best version so far.
// Writes runs/evolve-<time>/report.md (the reasoning for every decision) and lineage/<version>.json.
// Kept candidates are saved as harnesses/<version>.json. Command: cli/evolve.ts.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { evaluate, loadResults, loadSplit, saveResults, score, toRows, type ResultRow } from "../measure/evaluate.ts";
import { analyzeAttempt, evidenceMarkdown, type AttemptEvidence } from "../measure/evidence.ts";
import type { HarnessConfig } from "../agent/harness.ts";
import * as log from "../shared/log.ts";
import { nextName, pickFailed, propose, ProposalRejected } from "./propose.ts";

/** Settings for one evolve run. */
export interface EvolveOptions {
  start: HarnessConfig; // the harness version to start from
  rounds: number;
  proposer: "claude" | "random"; // Claude reads the failures, or the random-tip baseline
  k: number; // attempts per task
  budget: number; // dollars for the whole run
  baselines: string[]; // results.json files with saved scores of `start` (empty: measure it)
}

// State of the run in progress, set at the start of evolveRun().
let evolveDir = "";
let proposer: EvolveOptions["proposer"] = "claude";
let k = 3;
let budget = 2;
let spent = 0;
const costOf = (rows: ResultRow[]) => rows.reduce((total, r) => total + r.cost, 0);

// The random baseline's tips: generic advice, one picked at random per round.
const TIPS = [
  "Read every file involved before you edit anything.",
  "Follow every rule stated in code comments and documentation, even when no test checks it.",
  "After the visible tests pass, think about which inputs they don't cover and check those too.",
  "Keep your changes small; don't rewrite code that isn't related to the bug.",
  "Run the tests after every edit.",
  "The report may describe only one symptom; look for other bugs in the same code.",
  "Handle invalid inputs exactly the way the comments describe.",
  "Before finishing, re-read the function's documentation and confirm every sentence holds for your code.",
];

// ---------- Scores and the accept rule ----------

interface Scores {
  train: { passes: number; total: number };
  heldout: { passes: number; total: number };
  avgCost: number; // dollars per attempt, both splits
}

function scoresOf(rows: ResultRow[]): Scores {
  const train = score(rows, "train");
  const heldout = score(rows, "heldout");
  return { train: { passes: train.passes, total: train.total }, heldout: { passes: heldout.passes, total: heldout.total }, avgCost: costOf(rows) / rows.length };
}

interface Check {
  ok: boolean;
  text: string;
}

/** The accept rule from docs/phase4-plan.md: all three must pass. */
function checks(before: Scores, after: Scores): Check[] {
  const heldoutGain = after.heldout.passes - before.heldout.passes;
  const costRatio = after.avgCost / before.avgCost;
  return [
    { ok: heldoutGain >= 1, text: `held-out ${signed(heldoutGain)} (${before.heldout.passes} → ${after.heldout.passes} of ${after.heldout.total}; needs ≥ +1)` },
    { ok: after.train.passes >= before.train.passes, text: `train ${before.train.passes} → ${after.train.passes} of ${after.train.total} (must not drop)` },
    { ok: costRatio <= 1.5, text: `cost ${costRatio.toFixed(2)}× per attempt (max 1.5×)` },
  ];
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
const quote = (text: string) => text.trim().split("\n").map((line) => `> ${line}`).join("\n");
const link = (label: string, path: string) => `[${label}](${relative(evolveDir, path)})`;
const row = (label: string, s: Scores) => `| ${label} | ${s.train.passes}/${s.train.total} | ${s.heldout.passes}/${s.heldout.total} | ${s.avgCost.toFixed(4)} |`;

/** A free name for the candidate: v3 -> v4, or later if that name was already tried. */
function freeName(name: string): string {
  let next = nextName(name);
  while (existsSync(join("harnesses", `${next}.json`)) || existsSync(join("lineage", `${next}.json`))) next = nextName(next);
  return next;
}

/** Changes already tried from this parent and discarded, so the proposer doesn't repeat them. */
function alreadyTried(parentName: string): string {
  if (!existsSync("lineage")) return "";
  const tried = readdirSync("lineage")
    .map((f) => JSON.parse(readFileSync(join("lineage", f), "utf8")))
    .filter((entry) => entry.parent === parentName && entry.decision === "discarded");
  if (tried.length === 0) return "";
  return [`## Already tried from ${parentName} and discarded (held-out did not improve enough); don't repeat these`, ...tried.map((t) => `- ${t.name}: ${JSON.stringify(t.change.to)}`)].join("\n");
}

// ---------- One round ----------

/** What a round produced: whether the candidate was kept, and the scores to start the next round from. */
interface RoundResult {
  stop: boolean; // true when the run can't continue (no failures to learn from, rejected, budget)
  best: HarnessConfig;
  bestRows: ResultRow[];
  chain: string; // e.g. "v4 (kept)"
}

async function runRound(n: number, parent: HarnessConfig, before: ResultRow[], report: string[]): Promise<RoundResult> {
  const beforeScores = scoresOf(before);
  log.header(`ROUND ${n}`, `from ${parent.name} · train ${beforeScores.train.passes}/${beforeScores.train.total} · held-out ${beforeScores.heldout.passes}/${beforeScores.heldout.total}`);
  report.push(``, `## Round ${n} (from ${parent.name})`);

  // Evidence: why did TRAIN attempts fail? (Held-out failures are never shown to the proposer.)
  const trainEvidence: AttemptEvidence[] = before.filter((r) => r.split === "train").map((r) => analyzeAttempt(r.attemptDir));
  const failed = trainEvidence.filter((a) => !a.passed);
  const evidenceText = evidenceMarkdown(trainEvidence, evolveDir);
  const evidencePath = join(evolveDir, `round-${n}-evidence-train.md`);
  writeFileSync(evidencePath, evidenceText + "\n");
  report.push(`**Evidence** (failed train attempts of ${parent.name}: ${failed.length} of ${trainEvidence.length}) · ${link("full report", evidencePath)}`);
  const byReason = new Map<string, AttemptEvidence[]>();
  for (const a of failed) {
    for (const r of a.reasons) {
      const key = r.replace(/^\d+ tool error\(s\)$/, "tool errors"); // count "3 tool error(s)" and "5 tool error(s)" together
      byReason.set(key, [...(byReason.get(key) ?? []), a]);
    }
  }
  for (const [reason, list] of [...byReason].sort((x, y) => y[1].length - x[1].length)) {
    report.push(`- ${list.length}× ${reason} → ${list.map((a) => link(a.task, join(a.attemptDir, "summary.md"))).join(", ")}`);
  }
  if (failed.length === 0) {
    report.push(``, `**Decision: STOP.** No train attempt failed, so there is nothing to learn from.`);
    return { stop: true, best: parent, bestRows: before, chain: "(no failures to learn from)" };
  }

  // The candidate: from Claude, or one random tip (the baseline).
  let systemPrompt: string;
  let reason: string;
  let prediction: { trainPasses: number; heldoutChange: number; costChange: string } | null = null;
  if (proposer === "claude") {
    const summaries = pickFailed(failed).map((a) => readFileSync(join(a.attemptDir, "summary.md"), "utf8"));
    try {
      const p = await propose(parent, [evidenceText, alreadyTried(parent.name)].join("\n\n"), summaries, {
        trainPasses: beforeScores.train.passes,
        trainTotal: beforeScores.train.total,
        heldoutTotal: beforeScores.heldout.total,
      });
      spent += p.cost;
      systemPrompt = p.systemPrompt;
      reason = p.reason;
      prediction = { trainPasses: p.expectedTrainPasses, heldoutChange: p.expectedHeldoutChange, costChange: p.expectedCostChange };
    } catch (err) {
      if (!(err instanceof ProposalRejected)) throw err;
      spent += err.cost;
      report.push(``, `**Proposal: REJECTED** by the guardrails after 3 tries: ${err.problem}.`, `**Decision: STOP.** ${parent.name} stays; nothing was tested.`);
      return { stop: true, best: parent, bestRows: before, chain: "(proposal rejected)" };
    }
  } else {
    const unused = TIPS.filter((tip) => !parent.systemPrompt.includes(tip));
    const tip = unused[Math.floor(Math.random() * unused.length)]!;
    systemPrompt = `${parent.systemPrompt}\n${tip}`;
    reason = `Random baseline: one generic tip, picked at random: "${tip}"`;
  }
  const name = freeName(parent.name);
  const candidate: HarnessConfig = { ...parent, name, systemPrompt };
  writeFileSync(join(evolveDir, `${name}-candidate.json`), JSON.stringify(candidate, null, 2) + "\n");
  log.line(systemPrompt);

  // Score the candidate the same way. Stop cleanly if the budget runs out.
  let after: ResultRow[];
  try {
    after = toRows(await evaluate(candidate, ["train", "heldout"], k, budget - spent));
  } catch (err) {
    report.push(``, `**Decision: STOP.** ${(err as Error).message}; ${name} was not fully scored.`);
    return { stop: true, best: parent, bestRows: before, chain: `(${name}: budget reached)` };
  }
  saveResults(after, join(evolveDir, `${name}-results.json`));
  spent += costOf(after);
  const afterScores = scoresOf(after);

  // Decide with the 3 checks.
  const result = checks(beforeScores, afterScores);
  const keep = result.every((c) => c.ok);
  if (keep) writeFileSync(join("harnesses", `${name}.json`), JSON.stringify(candidate, null, 2) + "\n");
  const heldoutChange = afterScores.heldout.passes - beforeScores.heldout.passes;
  log.header(`DECISION ${n}`, `${keep ? "KEEP" : "DISCARD"} ${name}`);
  for (const c of result) log.attempt(c.ok ? "  ✓" : "  ✗", c.ok, c.text);

  // Lineage: every version tried, kept or not.
  mkdirSync("lineage", { recursive: true });
  const lineagePath = resolve("lineage", `${name}.json`);
  const lineage = {
    name,
    parent: parent.name,
    proposer,
    decision: keep ? "kept" : "discarded",
    date: new Date().toISOString(),
    change: { field: "systemPrompt", from: parent.systemPrompt, to: systemPrompt },
    reason,
    prediction,
    scores: { [parent.name]: beforeScores, [name]: afterScores },
    checks: result,
    run: relative(".", evolveDir),
  };
  writeFileSync(lineagePath, JSON.stringify(lineage, null, 2) + "\n");

  // The report section for this round.
  report.push(
    ``,
    `**Proposal** (${name}, ${proposer === "claude" ? "from Claude" : "random baseline"}: system prompt only)`,
    quote(reason),
    prediction
      ? `- Predicted: train ${prediction.trainPasses}/${beforeScores.train.total} · held-out ${signed(prediction.heldoutChange)} · cost ${prediction.costChange}`
      : `- Predicted: none (random baseline)`,
    ``,
    `New prompt (${name}):`,
    "```",
    systemPrompt,
    "```",
    ``,
    `**Result**`,
    `| | train | held-out | $/attempt |`,
    `|---|---|---|---|`,
    row(parent.name, beforeScores),
    row(name, afterScores),
    ``,
    `**Decision: ${keep ? `KEEP ${name}` : `DISCARD ${name}`}** (${keep ? "all three checks passed" : `${parent.name} stays`})`,
    ...result.map((c) => `- ${c.ok ? "✓" : "✗"} ${c.text}`),
    ...(prediction
      ? [`- Prediction: train predicted ${prediction.trainPasses}, actual ${afterScores.train.passes} · held-out predicted ${signed(prediction.heldoutChange)}, actual ${signed(heldoutChange)} → ${heldoutChange >= prediction.heldoutChange ? "confirmed" : "not confirmed"}`]
      : []),
    `- Files: ${link(`lineage/${name}.json`, lineagePath)}${keep ? ` · ${link(`harnesses/${name}.json`, resolve("harnesses", `${name}.json`))}` : ""} · ${link("results", join(evolveDir, `${name}-results.json`))}`,
  );
  return keep ? { stop: false, best: candidate, bestRows: after, chain: `${name} (kept)` } : { stop: false, best: parent, bestRows: before, chain: `${name} (discarded)` };
}

// ---------- The run ----------

/** Run several rounds from opts.start; returns the best version and the report's path. */
export async function evolveRun(opts: EvolveOptions): Promise<{ best: HarnessConfig; reportPath: string }> {
  proposer = opts.proposer;
  k = opts.k;
  budget = opts.budget;
  spent = 0;
  const split = loadSplit();
  evolveDir = resolve("runs", `evolve-${Date.now()}`);
  mkdirSync(evolveDir, { recursive: true });

  log.header("EVOLVE", `from ${opts.start.name} · proposer: ${proposer} · ${opts.rounds} round(s) · train ${split.train.length} tasks · held-out ${split.heldout.length} tasks · k=${k} · budget $${budget.toFixed(2)}`);

  // The start harness's scores: measured now, or reused from saved results of the same harness.
  let bestRows: ResultRow[];
  if (opts.baselines.length > 0) {
    bestRows = opts.baselines.flatMap((path) => loadResults(path));
    if (bestRows.some((r) => r.harness !== opts.start.name)) throw new Error(`a --baseline file is not a baseline of ${opts.start.name}`);
    for (const task of [...split.train, ...split.heldout]) {
      if (!bestRows.some((r) => r.task === task)) throw new Error(`the saved baseline has no results for ${task}; measure it first`);
    }
    log.header("BASELINE", `${opts.start.name} (reused from ${opts.baselines.length} file(s))`);
  } else {
    log.header("BASELINE", opts.start.name);
    bestRows = toRows(await evaluate(opts.start, ["train", "heldout"], k, budget));
    spent += costOf(bestRows);
  }
  saveResults(bestRows, join(evolveDir, "baseline-results.json"));
  const startScores = scoresOf(bestRows);

  const report: string[] = [
    `# Evolve run ${new Date().toISOString().slice(0, 16).replace("T", " ")} · proposer: ${proposer}`,
    `Start: harness ${opts.start.name} · ${opts.rounds} round(s) · train ${split.train.length} tasks · held-out ${split.heldout.length} tasks · k=${k} · budget $${budget.toFixed(2)}`,
    `Baseline ${opts.start.name}${opts.baselines.length > 0 ? " (reused)" : ""}: train ${startScores.train.passes}/${startScores.train.total} · held-out ${startScores.heldout.passes}/${startScores.heldout.total} · $${startScores.avgCost.toFixed(4)} per attempt`,
  ];

  let best = opts.start;
  const chain = [opts.start.name];
  for (let n = 1; n <= opts.rounds; n++) {
    const result = await runRound(n, best, bestRows, report);
    chain.push(result.chain);
    best = result.best;
    bestRows = result.bestRows;
    if (result.stop) break;
  }

  const finalScores = scoresOf(bestRows);
  report.push(
    ``,
    `## Summary`,
    `${chain.join(" → ")}`,
    `Best: ${best.name} · train ${finalScores.train.passes}/${finalScores.train.total} · held-out ${finalScores.heldout.passes}/${finalScores.heldout.total} (start ${startScores.heldout.passes}/${startScores.heldout.total}) · spent $${spent.toFixed(2)} of $${budget.toFixed(2)}`,
  );
  const reportPath = join(evolveDir, "report.md");
  writeFileSync(reportPath, report.join("\n") + "\n");

  log.header("TOTAL", `best: ${best.name} · spent $${spent.toFixed(4)}`);
  log.file("report", reportPath);
  return { best, reportPath };
}
