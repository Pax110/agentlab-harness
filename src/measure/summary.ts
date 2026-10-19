// summary.md: a short, readable version of one attempt's trace. For each turn it shows what
// Claude said (its reasoning) and what it did; then the changes, the grade, and why it failed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { failureReasons, graderSnippet } from "./evidence.ts";
import { readTrace, type EndEvent, type StartEvent, type ToolCallEvent } from "../shared/trace.ts";

// One line for a tool call: what was asked, and what came back.
function describeTool(t: ToolCallEvent): string {
  const input = t.input as { path?: string; content?: string };
  const asked = t.name === "write_file" ? `${input.path} (${input.content?.length ?? 0} chars)` : (input.path ?? "");
  const result = t.isError
    ? `✗ ${t.output.split("\n")[0]}`
    : t.name === "run_tests"
      ? t.output.split("\n")[0]
      : t.name === "list_files"
        ? `✓ ${t.output.split("\n").join(", ")}`
        : `✓ ${t.output.length} chars`;
  return `\`${t.name}\` ${asked} → ${result}`;
}

/** Write runDir/summary.md from runDir/trace.jsonl and return its path. */
export function writeSummary(runDir: string): string {
  const events = readTrace(join(runDir, "trace.jsonl"));
  const start = events.find((e): e is StartEvent => e.type === "start")!;
  const end = events.find((e): e is EndEvent => e.type === "end")!;

  const lines: string[] = [
    `# ${start.task} · harness ${start.harness.name} · ${end.passed ? "PASS" : "FAIL"}`,
    `${end.turns} turns · ${end.inputTokens} in / ${end.outputTokens} out · $${end.cost.toFixed(4)} · ${end.seconds.toFixed(1)} s · [trace](trace.jsonl)`,
    ``,
    `**Task:** ${start.instruction.trim()}`,
    ``,
    `## Steps`,
  ];
  for (const e of events) {
    if (e.type === "model_call") {
      lines.push(``, `**Turn ${e.turn}** (stop: ${e.stopReason})`);
      for (const block of e.content) {
        if (block.type === "text") lines.push(`> ${block.text.trim().replace(/\n+/g, " ")}`);
      }
    } else if (e.type === "tool_call") {
      lines.push(`- ${describeTool(e)}`);
    }
  }
  lines.push(``, `## Changes`, "```diff", end.diff.trim(), "```");
  lines.push(``, `## Grade: ${end.passed ? "PASS" : "FAIL"}`);
  if (!end.passed) {
    lines.push("```", graderSnippet(end.graderOutput), "```", ``, `## Why it failed`);
    lines.push(...failureReasons(events).map((r) => `- ${r}`));
  }

  const path = join(runDir, "summary.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
