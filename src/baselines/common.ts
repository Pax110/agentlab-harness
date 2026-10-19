// Shared pieces for the Phase 1 and Phase 2 baselines, built for later comparison with Phases 3–4.
// Neither baseline runs code while solving: it reads the code and answers. Only the hidden grader
// runs, at the end. That missing feedback loop is the difference from the Phase 3 agent.
import Anthropic from "@anthropic-ai/sdk";
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { diff, grade } from "../agent/solve.ts";

const client = new Anthropic();
export const MODEL = "claude-haiku-4-5";

/** A file of the task's project: its path relative to the project root, and its text. */
export interface File {
  path: string;
  content: string;
}

/** Every file in a folder, sorted by path. */
export function readRepo(dir: string): File[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((path) => statSync(join(dir, path)).isFile())
    .sort()
    .map((path) => ({ path, content: readFileSync(join(dir, path), "utf8") }));
}

/** A repo map: each file with the functions, classes and methods it defines (no bodies). */
export function repoMap(files: File[]): string {
  return files
    .map((f) => {
      const signatures = f.content
        .split("\n")
        .filter((line) => /^\s*export\s+(async\s+)?(function|class|const)\b/.test(line) || /^ {2}\w+\(.*\)\s*\{$/.test(line))
        .map((line) => `    ${line.trim().replace(/\s*\{$/, "")}`);
      return [f.path, ...signatures].join("\n");
    })
    .join("\n");
}

/** The files as one block of text for a prompt. */
export function showFiles(files: File[]): string {
  return files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n");
}

// ---------- The answer format: whole files between markers ----------

export const FILE_FORMAT = `Answer with the complete new content of every file you change, each in exactly this form:
=== FILE: <path> ===
<the whole file>
=== END FILE ===
Write whole files, not diffs. Leave out files you don't change.`;

/** The files in a model answer. A code fence (\`\`\`) around a file's content is removed. */
export function parseFiles(text: string): File[] {
  const files: File[] = [];
  for (const match of text.matchAll(/^=== FILE: (.+?) ===\n([\s\S]*?)^=== END FILE ===/gm)) {
    const content = match[2]!.replace(/^```[a-z]*\n/, "").replace(/\n```\n?$/, "\n");
    files.push({ path: match[1]!.trim(), content });
  }
  return files;
}

/** The answer most samples agree on (contents compared with whitespace ignored). */
export function vote(answers: File[][]): { files: File[]; votes: number; of: number } {
  const key = (files: File[]) => JSON.stringify([...files].sort((a, b) => a.path.localeCompare(b.path)).map((f) => [f.path, f.content.replace(/\s+/g, " ").trim()]));
  const counts = new Map<string, { files: File[]; votes: number }>();
  for (const files of answers.filter((a) => a.length > 0)) {
    const entry = counts.get(key(files)) ?? { files, votes: 0 };
    entry.votes++;
    counts.set(key(files), entry);
  }
  const best = [...counts.values()].sort((a, b) => b.votes - a.votes)[0];
  return { files: best?.files ?? [], votes: best?.votes ?? 0, of: answers.length };
}

// ---------- Calling Claude, with token counting ----------

export interface Usage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export const newUsage = (): Usage => ({ calls: 0, inputTokens: 0, outputTokens: 0 });

/** One Claude call; adds its tokens to `usage`. */
export async function ask(usage: Usage, params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">): Promise<Anthropic.Message> {
  const response = await client.messages.create({ model: MODEL, ...params });
  usage.calls++;
  usage.inputTokens += response.usage.input_tokens;
  usage.outputTokens += response.usage.output_tokens;
  return response;
}

export const textOf = (message: Anthropic.Message): string =>
  message.content.map((b) => (b.type === "text" ? b.text : "")).join("");

// Haiku 4.5: $1 per million input tokens, $5 per million output tokens.
export const costOf = (u: Usage): number => (u.inputTokens * 1 + u.outputTokens * 5) / 1_000_000;

// ---------- One attempt: workspace, apply the answer, grade ----------

/** What one baseline attempt produced (comparable with a Phase 3 RunResult). */
export interface BaselineResult {
  task: string;
  method: string; // e.g. "p1-zero-shot", "p2-agentless"
  passed: boolean;
  calls: number; // Claude calls (Phase 3 counts turns instead)
  inputTokens: number;
  outputTokens: number;
  cost: number;
  seconds: number;
  attemptDir: string;
}

/** A fresh copy of the task's code in runs/<task>-<method>-<time>/workspace/. */
export function startAttempt(taskDir: string, method: string): { attemptDir: string; workDir: string } {
  const attemptDir = resolve("runs", `${basename(taskDir)}-${method}-${Date.now()}`);
  const workDir = join(attemptDir, "workspace");
  cpSync(join(taskDir, "repo"), workDir, { recursive: true });
  return { attemptDir, workDir };
}

/** Write the answer's files into the workspace; paths outside it are skipped. Returns the written paths. */
export function applyFiles(workDir: string, files: File[]): string[] {
  const written: string[] = [];
  for (const f of files) {
    const full = resolve(workDir, f.path);
    if (!full.startsWith(workDir + sep)) continue;
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, f.content);
    written.push(f.path);
  }
  return written;
}

/** Grade the workspace with the hidden grader, then save result.json and a readable summary.md. */
export function finishAttempt(taskDir: string, method: string, attempt: { attemptDir: string; workDir: string }, usage: Usage, startedAt: number, notes: string[]): BaselineResult {
  const changes = diff(taskDir, attempt.workDir);
  const { passed, output } = grade(taskDir, attempt.workDir);
  const result: BaselineResult = {
    task: basename(taskDir),
    method,
    passed,
    calls: usage.calls,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cost: costOf(usage),
    seconds: (Date.now() - startedAt) / 1000,
    attemptDir: attempt.attemptDir,
  };
  writeFileSync(join(attempt.attemptDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
  const summary = [
    `# ${result.task} · ${method} · ${passed ? "PASS" : "FAIL"}`,
    `${usage.calls} Claude call(s) · ${usage.inputTokens} in / ${usage.outputTokens} out · $${result.cost.toFixed(4)} · ${result.seconds.toFixed(1)} s`,
    ``,
    `## Steps`,
    ...notes,
    ``,
    `## Changes`,
    "```diff",
    changes.trim(),
    "```",
    ``,
    `## Grade: ${passed ? "PASS" : "FAIL"}`,
    "```",
    output.trim().split("\n").slice(0, 8).join("\n"),
    "```",
  ];
  writeFileSync(join(attempt.attemptDir, "summary.md"), summary.join("\n") + "\n");
  return result;
}
