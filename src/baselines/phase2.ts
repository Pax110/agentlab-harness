// Phase 2 baseline: a fixed workflow with context engineering (Agentless-style).
// OUR code decides the steps, always the same three:
//   1. localize: Claude sees a repo map (files + function signatures) and picks the files to fix
//   2. repair:   Claude sees only those files (within a size budget) and writes a fix, 3 times
//   3. rank:     majority vote over the candidate fixes
// It is "feedforward": it never runs code or tests, so it can't notice a wrong fix and retry.
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyFiles, ask, FILE_FORMAT, finishAttempt, newUsage, parseFiles, readRepo, repoMap, showFiles, startAttempt, textOf, vote, type BaselineResult, type File } from "./common.ts";

const CONTEXT_BUDGET = 20_000; // characters of code shown in the repair step

const chooseFilesTool: Anthropic.Tool = {
  name: "choose_files",
  description: "Choose the files that most likely contain the bug.",
  input_schema: {
    type: "object",
    properties: {
      files: { type: "array", items: { type: "string" }, description: "Paths from the repository map" },
      reason: { type: "string", description: "Why these files" },
    },
    required: ["files", "reason"],
  },
};

/** One Phase 2 attempt at one task. */
export async function solvePhase2(taskDir: string, candidates = 3): Promise<BaselineResult> {
  const startedAt = Date.now();
  const method = "p2-agentless";
  const attempt = startAttempt(taskDir, method);
  const usage = newUsage();
  const instruction = readFileSync(join(taskDir, "task.md"), "utf8").trim();
  const files = readRepo(attempt.workDir);

  // 1. Localize: from the map only, pick the files to look at.
  const located = await ask(usage, {
    system: "You locate bugs in small JavaScript projects.",
    max_tokens: 1000,
    tools: [chooseFilesTool],
    tool_choice: { type: "tool", name: "choose_files" },
    messages: [{ role: "user", content: `Task: ${instruction}\n\nRepository map (files and what they define):\n${repoMap(files)}` }],
  });
  const call = located.content.find((b) => b.type === "tool_use");
  const choice = (call?.input ?? { files: [], reason: "" }) as { files: string[]; reason: string };
  let chosen = files.filter((f) => choice.files.includes(f.path));
  if (chosen.length === 0) chosen = files; // nothing usable chosen: fall back to every file

  // 2. Context: the chosen files, within the budget (the rest is left out, and we say so).
  const shown: File[] = [];
  let size = 0;
  for (const f of chosen) {
    if (size + f.content.length > CONTEXT_BUDGET) break;
    shown.push(f);
    size += f.content.length;
  }
  const leftOut = chosen.length - shown.length;
  const context = [
    `Task: ${instruction}`,
    `Repository map:\n${repoMap(files)}`,
    `Relevant files:\n${showFiles(shown)}`,
    leftOut > 0 ? `(${leftOut} more chosen file(s) left out to stay within the context budget.)` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // 3. Repair: several independent candidate fixes.
  const answers: File[][] = [];
  for (let i = 0; i < candidates; i++) {
    const response = await ask(usage, {
      system: `You fix bugs in small JavaScript projects. You cannot run anything; you answer once.\n\n${FILE_FORMAT}`,
      max_tokens: 8000,
      messages: [{ role: "user", content: context }],
    });
    answers.push(parseFiles(textOf(response)));
  }

  // 4. Rank: the fix most candidates agree on.
  const winner = vote(answers);
  const written = applyFiles(attempt.workDir, winner.files);
  const notes = [
    `- localize: chose ${chosen.map((f) => f.path).join(", ")}${choice.reason ? `: "${choice.reason}"` : ""}`,
    `- context: ${shown.length} file(s), ${size} characters${leftOut > 0 ? `, ${leftOut} left out (budget ${CONTEXT_BUDGET})` : ""}`,
    `- repair: ${candidates} candidate fixes`,
    `- rank: majority vote, winner had ${winner.votes} of ${winner.of} votes`,
    `- files written: ${written.length > 0 ? written.join(", ") : "none (no file in the expected format)"}`,
  ];
  return finishAttempt(taskDir, method, attempt, usage, startedAt, notes);
}
