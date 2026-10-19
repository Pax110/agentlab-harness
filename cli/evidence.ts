// Failure report for one run.ts run: why its attempts failed (rules over their traces). Free.
//   npx tsx cli/evidence.ts runs/run-<time>           (every attempt of the run)
//   npx tsx cli/evidence.ts runs/run-<time> train     (only the training tasks)
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeAttempt, evidenceMarkdown } from "../src/measure/evidence.ts";
import * as log from "../src/shared/log.ts";

const runDir = resolve(process.argv[2] ?? "");
const onlySplit = process.argv[3]; // optional: "train" or "heldout"
const results: { split: string; attemptDir: string }[] = JSON.parse(readFileSync(join(runDir, "results.json"), "utf8"));
const list = results.filter((r) => !onlySplit || r.split === onlySplit).map((r) => analyzeAttempt(r.attemptDir));

const reportPath = join(runDir, onlySplit ? `evidence-${onlySplit}.md` : "evidence.md");
writeFileSync(reportPath, evidenceMarkdown(list, runDir) + "\n");

const failed = list.filter((a) => !a.passed);
log.header("EVIDENCE", `${failed.length} of ${list.length} attempts failed${onlySplit ? ` (${onlySplit})` : ""}`);
for (const a of failed) log.attempt(`${a.task} · ${a.harness}`, false, a.reasons.join(" · "));
log.file("report", reportPath);
