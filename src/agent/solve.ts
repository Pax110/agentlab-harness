// One attempt at one task: copy the task's code, run the agent loop on it, grade the result.
import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { HarnessConfig } from "./harness.ts";
import * as log from "../shared/log.ts";
import { writeSummary } from "../measure/summary.ts";
import { appendEvent } from "../shared/trace.ts";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5";

/** Output settings for one attempt. The harness itself comes from a HarnessConfig. */
export interface SolveOptions {
  showResponses?: boolean; // print each full API response (for learning/debugging)
}

/** What one attempt produced. */
export interface RunResult {
  task: string;
  harness: string; // the config's name
  passed: boolean;
  turns: number;
  runTestsCalls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number; // dollars
  seconds: number;
  workDir: string;
  tracePath: string; // JSONL file with every event of this attempt
  summaryPath: string; // short readable Markdown version of the trace
  messages: Anthropic.MessageParam[]; // the whole conversation
}

// ---------- Tools ----------

// What Claude must send when it calls each tool.
interface ReadFileInput {
  path: string;
}
interface WriteFileInput {
  path: string;
  content: string;
}

// The tools as Claude sees them: a name, a description, and a JSON schema for the input.
// The descriptions here are placeholders; the real ones come from the HarnessConfig.
const listFilesTool: Anthropic.Tool = {
  name: "list_files",
  description: "",
  input_schema: { type: "object", properties: {} },
};
const readFileTool: Anthropic.Tool = {
  name: "read_file",
  description: "",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path relative to the project root" },
    },
    required: ["path"],
  },
};
const writeFileTool: Anthropic.Tool = {
  name: "write_file",
  description: "",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path relative to the project root" },
      content: { type: "string", description: "The complete new file content" },
    },
    required: ["path", "content"],
  },
};
const runTestsTool: Anthropic.Tool = {
  name: "run_tests",
  description: "",
  input_schema: { type: "object", properties: {} },
};

// Turn a path from Claude into a real path, refusing anything outside the workspace.
function safePath(workDir: string, path: string): string {
  const full = resolve(workDir, path);
  if (full !== workDir && !full.startsWith(workDir + sep)) throw new Error(`Path is outside the project: ${path}`);
  return full;
}

// Every file in the workspace, one relative path per line.
function listFiles(workDir: string): string {
  const entries = readdirSync(workDir, { recursive: true }) as string[];
  const files = entries.filter((entry) => statSync(join(workDir, entry)).isFile()).sort();
  return files.length > 0 ? files.join("\n") : "(no files)";
}

function readFile(workDir: string, input: ReadFileInput): string {
  return readFileSync(safePath(workDir, input.path), "utf8");
}

function writeFile(workDir: string, input: WriteFileInput): string {
  const full = safePath(workDir, input.path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, input.content);
  return `Wrote ${input.content.length} characters to ${input.path}`;
}

// Run the visible tests in the workspace. Failing tests are a normal result, not a tool error.
export function runTests(workDir: string): string {
  try {
    const output = execFileSync("node", ["--test", "--test-reporter=spec"], { cwd: workDir, encoding: "utf8", timeout: 30_000, stdio: "pipe" });
    return `All tests passed.\n${output}`;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return `Some tests failed.\n${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

// Run the tool Claude asked for. Throws on failure; the caller sends the error back to Claude.
function runTool(workDir: string, name: string, input: unknown): string {
  switch (name) {
    case "list_files":
      return listFiles(workDir);
    case "read_file":
      return readFile(workDir, input as ReadFileInput);
    case "write_file":
      return writeFile(workDir, input as WriteFileInput);
    case "run_tests":
      return runTests(workDir);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------- Grading (after the agent is done) ----------

// What changed: the original repo/ against the agent's workspace.
export function diff(taskDir: string, workDir: string): string {
  try {
    execFileSync("git", ["diff", "--no-index", "--no-color", relative(".", join(taskDir, "repo")), relative(".", workDir)], { encoding: "utf8" });
    return "(no changes)";
  } catch (err) {
    return (err as { stdout: string }).stdout; // git diff exits with 1 when files differ
  }
}

// Run the hidden check inside the workspace. Exit code 0 means PASS.
export function grade(taskDir: string, workDir: string): { passed: boolean; output: string } {
  try {
    const output = execFileSync("node", [join(taskDir, "check.js")], { cwd: workDir, encoding: "utf8", timeout: 10_000, stdio: "pipe" });
    return { passed: true, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; signal?: string };
    // A grader killed by the timeout prints nothing, so say why it failed.
    const timedOut = e.signal === "SIGTERM" ? "Timed out after 10 s: the code probably loops forever.\n" : "";
    return { passed: false, output: `${timedOut}${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

// ---------- The agent loop ----------

/**
 * A task folder holds repo/ (the code to fix), task.md (the instruction)
 * and check.js (the hidden grader, never shown to the agent).
 */
export async function solve(taskDir: string, config: HarnessConfig, options: SolveOptions = {}): Promise<RunResult> {
  const start = Date.now();
  const instruction = readFileSync(join(taskDir, "task.md"), "utf8");
  // The tool list from the config: which tools are offered, and how each one is described.
  const offered = [
    ...(config.offerListFiles ? [listFilesTool] : []),
    readFileTool,
    writeFileTool,
    ...(config.offerRunTests ? [runTestsTool] : []),
  ];
  const tools = offered.map((tool) => ({ ...tool, description: config.toolDescriptions[tool.name as keyof HarnessConfig["toolDescriptions"]] }));

  // Each attempt gets its own folder: workspace/ (a fresh copy of repo/, so the original
  // stays buggy for the next attempt) and trace.jsonl (outside the workspace, so the agent can't read it).
  const runDir = resolve("runs", `${basename(taskDir)}-${Date.now()}`);
  const workDir = join(runDir, "workspace");
  const tracePath = join(runDir, "trace.jsonl");
  cpSync(join(taskDir, "repo"), workDir, { recursive: true });
  appendEvent(tracePath, { type: "start", task: basename(taskDir), model: MODEL, harness: config, instruction });

  // The whole conversation so far. The API is stateless, so every call sends all of it.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: instruction }];
  let inputTokens = 0;
  let outputTokens = 0;
  let turns = 0;
  let runTestsCalls = 0;

  log.header("TASK", `${relative(".", taskDir)} · harness: ${config.name} · tools: ${tools.map((t) => t.name).join(", ")}`);
  log.line(instruction.trim());

  // Call Claude, run the tools it asks for, send results back, repeat.
  for (let turn = 1; turn <= config.maxTurns; turn++) {
    const callStart = Date.now();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: config.systemPrompt,
      tools,
      messages,
    });
    messages.push({ role: "assistant", content: response.content });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    turns = turn;
    const { input_tokens, output_tokens } = response.usage;
    appendEvent(tracePath, {
      type: "model_call",
      turn,
      stopReason: response.stop_reason,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      ms: Date.now() - callStart,
      content: response.content,
    });
    log.header(`TURN ${turn}`, `stop: ${response.stop_reason} · ${input_tokens} in / ${output_tokens} out`);
    if (options.showResponses) log.dump(`FULL RESPONSE (turn ${turn})`, response);

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        log.claude(block.text);
      } else if (block.type === "tool_use") {
        log.toolCall(block.name, block.input);
        if (block.name === "run_tests") runTestsCalls++;
        const toolStart = Date.now();
        let content: string;
        let isError = false;
        try {
          content = runTool(workDir, block.name, block.input);
        } catch (err) {
          content = String(err);
          isError = true;
        }
        appendEvent(tracePath, { type: "tool_call", turn, name: block.name, input: block.input, output: content, isError, ms: Date.now() - toolStart });
        log.toolResult(content, isError);
        results.push({ type: "tool_result", tool_use_id: block.id, content, is_error: isError });
      }
    }

    // No tool requests means Claude is done.
    if (response.stop_reason !== "tool_use") break;
    messages.push({ role: "user", content: results });
    if (turn === config.maxTurns) log.header("STOPPED", `reached ${config.maxTurns} turns`);
  }

  const changes = diff(taskDir, workDir);
  log.header("DIFF", relative(".", workDir));
  log.line(changes);

  const { passed, output } = grade(taskDir, workDir);
  log.verdict(passed, output.trim().split("\n").slice(0, 4).join("\n"));

  // Haiku 4.5: $1 per million input tokens, $5 per million output tokens.
  const cost = (inputTokens * 1 + outputTokens * 5) / 1_000_000;
  const seconds = (Date.now() - start) / 1000;
  appendEvent(tracePath, { type: "end", passed, graderOutput: output, turns, inputTokens, outputTokens, cost, seconds, diff: changes });
  log.header("TOTAL", `${turns} turns · ${inputTokens} in / ${outputTokens} out · $${cost.toFixed(4)}`);
  const summaryPath = writeSummary(runDir);
  log.file("summary", summaryPath);
  log.file("trace", tracePath);

  return {
    task: basename(taskDir),
    harness: config.name,
    passed,
    turns,
    runTestsCalls,
    inputTokens,
    outputTokens,
    cost,
    seconds,
    workDir,
    tracePath,
    summaryPath,
    messages,
  };
}
