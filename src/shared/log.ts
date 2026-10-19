// Console output helpers. Import as a namespace (`import * as log from "./log.ts"`) so every call reads `log.something(...)` and is clearly output-only.
import { inspect, styleText } from "node:util";

// When quiet, every helper prints nothing. run.ts uses this to hide the turn-by-turn output.
let quiet = false;
export function setQuiet(value: boolean): void {
  quiet = value;
}

/** A bold section title, e.g. "━━ TURN 2  stop: tool_use · 512 in / 40 out". */
export function header(title: string, detail = ""): void {
  if (quiet) return;
  console.log("\n" + styleText(["bold", "cyan"], `━━ ${title}`) + "  " + styleText("dim", detail));
}

/** A plain line of text, e.g. the prompt. */
export function line(text: string): void {
  if (quiet) return;
  console.log(text);
}

/** Text written by Claude. */
export function claude(text: string): void {
  if (quiet) return;
  console.log(styleText("green", "Claude: ") + text);
}

/** A tool call Claude asked for, with its input on one line (long strings cut short). */
export function toolCall(name: string, input: unknown): void {
  if (quiet) return;
  console.log(styleText("yellow", `→ ${name} `) + inspect(input, { colors: true, breakLength: Infinity, maxStringLength: 60 }));
}

/** The grader's verdict: a green PASS or a red FAIL, then its output. */
export function verdict(passed: boolean, output: string): void {
  if (quiet) return;
  header("GRADE");
  console.log(passed ? styleText(["bold", "green"], "PASS") : styleText(["bold", "red"], "FAIL"));
  if (output) console.log(styleText("dim", output));
}

/** A tool result: ok/error, its size, and the first line as a preview. */
export function toolResult(content: string, isError: boolean): void {
  if (quiet) return;
  const status = isError ? styleText("red", "✗ error") : styleText("dim", "✓ ok");
  const preview = content.split("\n")[0]!.slice(0, 80);
  console.log(`  ${status} · ${content.length} chars · ${styleText("dim", preview)}`);
}

/** A file to open: its absolute path (Ctrl+click in the VS Code terminal) and the `code` command. */
export function file(label: string, path: string): void {
  if (quiet) return;
  console.log(`${styleText("bold", label)}: ${path}`);
  console.log(styleText("dim", `  open with: code ${path}`));
}

/** One finished attempt on one line: label, PASS/FAIL, details. */
export function attempt(label: string, passed: boolean, detail: string): void {
  if (quiet) return;
  const status = passed ? styleText("green", "PASS") : styleText("red", "FAIL");
  console.log(`${label}  ${status}  ${styleText("dim", detail)}`);
}

/** Rows of results as a table. */
export function table(rows: Record<string, string>[]): void {
  if (quiet) return;
  console.table(rows);
}

/** A whole object, every nested level, under a labelled header. */
export function dump(label: string, value: unknown): void {
  if (quiet) return;
  header(label);
  console.dir(value, { depth: null, colors: true });
}
