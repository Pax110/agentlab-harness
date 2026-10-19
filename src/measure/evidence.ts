// Evidence: WHY attempts failed, worked out from their traces with simple rules.
// Phase 4's proposer reads this report to suggest a harness change. Command: cli/evidence.ts.
import { join, relative } from "node:path";
import { readTrace, type EndEvent, type ModelCallEvent, type StartEvent, type ToolCallEvent, type TraceEvent } from "../shared/trace.ts";

/** What we learned from one attempt. */
export interface AttemptEvidence {
  task: string;
  harness: string;
  passed: boolean;
  reasons: string[]; // why it failed (empty when it passed)
  graderSnippet: string; // the first useful lines of the grader's output
  attemptDir: string; // runs/<task>-<time>/ with trace.jsonl and summary.md
}

/** The failure rules. Each one looks for a pattern in the trace and names it. */
export function failureReasons(events: TraceEvent[]): string[] {
  const start = events.find((e): e is StartEvent => e.type === "start")!;
  const end = events.find((e): e is EndEvent => e.type === "end")!;
  if (end.passed) return [];

  const calls = events.filter((e): e is ModelCallEvent => e.type === "model_call");
  const tools = events.filter((e): e is ToolCallEvent => e.type === "tool_call");
  const testRuns = tools.filter((t) => t.name === "run_tests");
  const lastStop = calls.at(-1)?.stopReason;
  const reasons: string[] = [];

  if (lastStop === "tool_use" && end.turns >= start.harness.maxTurns) reasons.push("hit the turn limit");
  if (lastStop === "max_tokens" || lastStop === "refusal") reasons.push(`stopped early: ${lastStop}`);
  if (!tools.some((t) => t.name === "write_file" && !t.isError)) reasons.push("never changed a file");
  if (start.harness.offerRunTests && testRuns.length === 0) reasons.push("never ran the visible tests");
  const lastTests = testRuns.at(-1)?.output ?? "";
  if (lastTests.startsWith("Some tests failed")) reasons.push("visible tests still failing at the end");
  if (lastTests.startsWith("All tests passed")) reasons.push("visible tests passed, hidden grader failed: missed a rule the visible tests don't check");
  if (end.graderOutput.startsWith("Timed out")) reasons.push("grader timed out: the code probably loops forever");
  const toolErrors = tools.filter((t) => t.isError).length;
  if (toolErrors > 0) reasons.push(`${toolErrors} tool error(s)`);
  if (reasons.length === 0) reasons.push("hidden grader failed");
  return reasons;
}

/** The grader lines worth reading: the timeout note, or the assertion's actual/expected values. */
export function graderSnippet(graderOutput: string): string {
  const lines = graderOutput.split("\n").map((l) => l.trim());
  const useful = lines.filter((l) => /^(Timed out|actual:|expected:|AssertionError|Error:|TypeError|ReferenceError|SyntaxError)/.test(l));
  return (useful.length > 0 ? useful : lines.filter(Boolean)).slice(0, 4).join("\n");
}

/** Evidence for one attempt folder. */
export function analyzeAttempt(attemptDir: string): AttemptEvidence {
  const events = readTrace(join(attemptDir, "trace.jsonl"));
  const start = events.find((e): e is StartEvent => e.type === "start")!;
  const end = events.find((e): e is EndEvent => e.type === "end")!;
  return {
    task: start.task,
    harness: start.harness.name,
    passed: end.passed,
    reasons: failureReasons(events),
    graderSnippet: end.passed ? "" : graderSnippet(end.graderOutput),
    attemptDir,
  };
}

/** The report as Markdown: how often each reason occurred, then every failure with links. */
export function evidenceMarkdown(list: AttemptEvidence[], reportDir: string): string {
  const failed = list.filter((a) => !a.passed);
  const counts = new Map<string, number>();
  for (const a of failed) for (const r of a.reasons) counts.set(r.replace(/^\d+ tool error\(s\)$/, "tool errors"), (counts.get(r) ?? 0) + 1);
  const link = (a: AttemptEvidence) => `[summary](${relative(reportDir, join(a.attemptDir, "summary.md"))})`;
  return [
    `# Failure report`,
    ``,
    `${failed.length} of ${list.length} attempts failed.`,
    ``,
    `## Reasons (an attempt can have several)`,
    ...[...counts].sort((a, b) => b[1] - a[1]).map(([reason, n]) => `- ${n}× ${reason}`),
    ``,
    `## Failed attempts`,
    ...failed.flatMap((a) => [
      `### ${a.task} · ${a.harness} · ${link(a)}`,
      ...a.reasons.map((r) => `- ${r}`),
      "```",
      a.graderSnippet,
      "```",
    ]),
  ].join("\n");
}
