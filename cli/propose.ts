// Try the proposer alone: one Claude call (about $0.01), nothing tested.
// Reads a run's TRAIN failures and saves harnesses/<next>-candidate.json + .proposal.json.
//   npx tsx --env-file=.env.local cli/propose.ts runs/run-<time> harnesses/v3.json
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig, type HarnessConfig } from "../src/agent/harness.ts";
import { nextName, pickFailed, propose } from "../src/evolve/propose.ts";
import { loadSplit } from "../src/measure/evaluate.ts";
import { analyzeAttempt, evidenceMarkdown, type AttemptEvidence } from "../src/measure/evidence.ts";
import * as log from "../src/shared/log.ts";

const runDir = resolve(process.argv[2] ?? "");
const configPath = process.argv[3] ?? "harnesses/v1.json";
const config = loadConfig(configPath);

// Evidence from the TRAINING attempts only: the proposer must never see held-out failures.
const results: { split: string; attemptDir: string }[] = JSON.parse(readFileSync(join(runDir, "results.json"), "utf8"));
const train: AttemptEvidence[] = results.filter((r) => r.split === "train").map((r) => analyzeAttempt(r.attemptDir));
const failed = train.filter((a) => !a.passed);
if (failed.length === 0) throw new Error("No failed training attempts: nothing to learn from.");

const picked = pickFailed(failed);
const summaries = picked.map((a) => readFileSync(join(a.attemptDir, "summary.md"), "utf8"));

log.header("PROPOSE", `from ${failed.length} failed training attempts · showing ${picked.length} in detail`);
const heldoutTotal = results.filter((r) => r.split === "heldout").length || loadSplit().heldout.length * 3;
const context = { trainPasses: train.filter((a) => a.passed).length, trainTotal: train.length, heldoutTotal };
const proposal = await propose(config, evidenceMarkdown(train, runDir), summaries, context);

// Save the candidate (same harness, new system prompt) and the proposal's reasoning next to it.
const name = nextName(config.name);
const candidate: HarnessConfig = { ...config, name, systemPrompt: proposal.systemPrompt };
const candidatePath = resolve("harnesses", `${name}-candidate.json`);
writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + "\n");
loadConfig(candidatePath); // check it like any harness file
const proposalPath = resolve("harnesses", `${name}-candidate.proposal.json`);
writeFileSync(proposalPath, JSON.stringify({ parent: config.name, fromRun: runDir, reason: proposal.reason, expectedTrainPasses: proposal.expectedTrainPasses, expectedHeldoutChange: proposal.expectedHeldoutChange, expectedCostChange: proposal.expectedCostChange, cost: proposal.cost }, null, 2) + "\n");

log.header("OLD SYSTEM PROMPT", config.name);
log.line(config.systemPrompt);
log.header("NEW SYSTEM PROMPT", name);
log.line(proposal.systemPrompt);
log.header("REASON");
log.line(proposal.reason);
log.header("PREDICTION");
log.line(`train ${proposal.expectedTrainPasses}/${context.trainTotal} (now ${context.trainPasses}) · held-out ${proposal.expectedHeldoutChange >= 0 ? "+" : ""}${proposal.expectedHeldoutChange} · cost ${proposal.expectedCostChange}`);
log.header("COST", `$${proposal.cost.toFixed(4)}`);
log.file("candidate", candidatePath);
log.file("proposal", proposalPath);
