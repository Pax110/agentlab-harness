// Phase 1 baseline: prompt engineering. One answer, no tools, no loop.
// Claude sees the instruction and every file of the project, and answers once with the fixed
// file(s). It cannot look anything up, run the tests, or correct itself.
// Variants: zero-shot, few-shot (one worked example), chain-of-thought (reason before answering),
// and self-consistency (5 independent answers, majority vote).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyFiles, ask, FILE_FORMAT, finishAttempt, newUsage, parseFiles, readRepo, showFiles, startAttempt, textOf, vote, type BaselineResult, type File } from "./common.ts";

export type Phase1Variant = "zero-shot" | "few-shot" | "cot" | "self-consistency";

const SYSTEM = `You fix bugs in small JavaScript projects. You cannot run anything: you only see the files below, and you answer once.

${FILE_FORMAT}`;

// A made-up worked example (not one of the tasks), shown in the few-shot variant.
const EXAMPLE = `Here is an example of a task and a good answer.

Task: max([3, 9, 2]) returns 3 instead of 9. Fix max.js.

--- max.js ---
// Returns the largest number in a non-empty array.
export function max(numbers) {
  let best = numbers[0];
  for (const n of numbers) if (n < best) best = n;
  return best;
}

Answer:
=== FILE: max.js ===
// Returns the largest number in a non-empty array.
export function max(numbers) {
  let best = numbers[0];
  for (const n of numbers) if (n > best) best = n;
  return best;
}
=== END FILE ===

Now the real task.`;

const COT = `First, under the heading "Reasoning:", think step by step: what the code must do according to its comments and tests, what is wrong, and every case your fix must handle. Then give the files.`;

/** One Phase 1 attempt at one task. */
export async function solvePhase1(taskDir: string, variant: Phase1Variant, samples = 5): Promise<BaselineResult> {
  const startedAt = Date.now();
  const method = `p1-${variant}`;
  const attempt = startAttempt(taskDir, method);
  const usage = newUsage();

  // The whole project goes into the prompt: Phase 1 has no way to look anything up.
  const instruction = readFileSync(join(taskDir, "task.md"), "utf8").trim();
  const files = readRepo(attempt.workDir);
  const prompt = [variant === "few-shot" ? EXAMPLE : "", `Task: ${instruction}`, showFiles(files), variant === "cot" ? COT : ""].filter(Boolean).join("\n\n");

  const answers: File[][] = [];
  const count = variant === "self-consistency" ? samples : 1;
  for (let i = 0; i < count; i++) {
    const response = await ask(usage, { system: SYSTEM, max_tokens: 8000, messages: [{ role: "user", content: prompt }] });
    answers.push(parseFiles(textOf(response)));
  }

  const chosen = count > 1 ? vote(answers) : { files: answers[0] ?? [], votes: 1, of: 1 };
  const written = applyFiles(attempt.workDir, chosen.files);
  const notes = [
    `- 1 prompt with the instruction and all ${files.length} files${variant === "few-shot" ? ", plus one worked example" : ""}${variant === "cot" ? ", asking for reasoning first" : ""}`,
    `- ${count} answer(s); ${count > 1 ? `the most common one won with ${chosen.votes} of ${chosen.of} votes` : "used as is"}`,
    `- files written: ${written.length > 0 ? written.join(", ") : "none (no file in the expected format)"}`,
  ];
  return finishAttempt(taskDir, method, attempt, usage, startedAt, notes);
}
