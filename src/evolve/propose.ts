// The proposer: Claude reads the failure evidence from the TRAINING tasks and proposes one
// change to the harness (only the system prompt, for now). Nothing is tested here.
// Used by evolve.ts each round; to try it alone, see cli/propose.ts.
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { AttemptEvidence } from "../measure/evidence.ts";
import type { HarnessConfig } from "../agent/harness.ts";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5";

/** What the proposer returns. */
export interface Proposal {
  systemPrompt: string; // the complete new system prompt
  reason: string; // why this should fix the failures
  expectedTrainPasses: number; // predicted train passes with the new prompt (same number of attempts)
  expectedHeldoutChange: number; // predicted change in held-out passes, e.g. +1
  expectedCostChange: string; // predicted change in cost per attempt, e.g. "+10%"
  cost: number; // dollars spent on the proposer call
}

/** The current scores the proposer may see: train passes, and only the SIZE of the held-out set. */
export interface ProposerContext {
  trainPasses: number;
  trainTotal: number;
  heldoutTotal: number;
}

// The proposer answers by calling this tool; its schema fixes the shape of the answer.
const submitTool: Anthropic.Tool = {
  name: "submit_proposal",
  description: "Submit your proposed harness change.",
  input_schema: {
    type: "object",
    properties: {
      systemPrompt: { type: "string", description: "The complete new system prompt for the agent" },
      reason: { type: "string", description: "Which failure pattern this addresses and why it should help" },
      expectedTrainPasses: { type: "integer", description: "How many train attempts you expect to pass with the new prompt" },
      expectedHeldoutChange: { type: "integer", description: "Expected change in held-out passes versus the current harness, e.g. 1 or 0 or -1" },
      expectedCostChange: { type: "string", description: 'Expected change in cost per attempt, e.g. "+10%"' },
    },
    required: ["systemPrompt", "reason", "expectedTrainPasses", "expectedHeldoutChange", "expectedCostChange"],
  },
};

const instructions = `You improve the harness of a coding agent. The agent is a frozen model (${MODEL}) that fixes bugs in small JavaScript projects using the tools offered by its harness (shown below). After the agent finishes, a hidden grader decides PASS or FAIL.

You may change ONLY the agent's system prompt. Read the current harness, the failure report and the failed attempts, find the general pattern behind the failures, and write a better system prompt.

Rules:
- Give general working advice that would help on any similar bug-fixing task. Never mention specific tasks, file names, function names or expected values: the change is judged on other tasks you have not seen.
- Keep what already works, and keep the prompt short (at most about 120 words).
- Predict the effect honestly as numbers: train passes out of the same number of attempts, the change in held-out passes, and the change in cost per attempt.

Answer by calling submit_proposal.`;

/** Words the new prompt must not contain: task folder names and the file names in every task. */
function forbiddenWords(): string[] {
  const words = new Set<string>();
  for (const task of readdirSync("tasks")) {
    words.add(task.replace(/^\d+-/, "")); // "money-format"
    for (const file of readdirSync(join("tasks", task, "repo"))) words.add(file); // "format.js"
  }
  return [...words].filter((w) => w.length > 3); // skip very short names like "sum" that are ordinary words
}

/** Ask Claude for one change. `failedSummaries` are summary.md texts of failed training attempts. */
export async function propose(config: HarnessConfig, evidence: string, failedSummaries: string[], context: ProposerContext): Promise<Proposal> {
  const input = [
    `## Current scores`,
    `Train: ${context.trainPasses} of ${context.trainTotal} attempts passed. Held-out: ${context.heldoutTotal} attempts (results not shown to you).`,
    `## Current harness (${config.name})`,
    "```json",
    JSON.stringify(config, null, 2),
    "```",
    evidence,
    `## Failed attempts, step by step`,
    ...failedSummaries,
  ].join("\n\n");

  // Up to 3 tries: if a proposal breaks a guardrail, Claude is told why and asked again.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: input }];
  let cost = 0;
  let problem = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: instructions,
      tools: [submitTool],
      tool_choice: { type: "tool", name: "submit_proposal" }, // must answer with the tool
      messages,
    });
    cost += (response.usage.input_tokens * 1 + response.usage.output_tokens * 5) / 1_000_000;
    const call = response.content.find((b) => b.type === "tool_use");
    if (!call) throw new ProposalRejected(`the proposer did not call submit_proposal (stop: ${response.stop_reason})`, cost);
    const answer = call.input as Omit<Proposal, "cost">;

    problem = guardrailProblem(answer.systemPrompt);
    if (problem === "") return { ...answer, cost };

    // Send the rejection back as the tool's result, so Claude can fix its proposal.
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Rejected: ${problem}. Submit a corrected proposal.` }] });
  }
  throw new ProposalRejected(problem, cost);
}

/** Thrown when no acceptable proposal came back; `cost` is what the tries cost. */
export class ProposalRejected extends Error {
  constructor(
    readonly problem: string,
    readonly cost: number,
  ) {
    super(`Proposal rejected: ${problem}`);
    this.name = "ProposalRejected";
  }
}

/** Guardrails: a general prompt only, nothing that names the tasks. Returns "" when it's fine. */
export function guardrailProblem(systemPrompt: string): string {
  // Whole words only, so "chunks of work" isn't confused with the task "chunk".
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const leaked = forbiddenWords().filter((w) => new RegExp(`(^|[^a-z0-9])${escape(w.toLowerCase())}([^a-z0-9]|$)`).test(systemPrompt.toLowerCase()));
  if (leaked.length > 0) return `it names task details (${leaked.join(", ")}); use general advice only`;
  if (systemPrompt.length > 1500) return `it is too long (${systemPrompt.length} characters, max 1500)`;
  return "";
}

/** Up to `max` failed attempts to show in detail: one per task first, so different failures are shown. */
export function pickFailed(failed: AttemptEvidence[], max = 3): AttemptEvidence[] {
  const picked: AttemptEvidence[] = [];
  for (const a of failed) if (picked.length < max && !picked.some((p) => p.task === a.task)) picked.push(a);
  for (const a of failed) if (picked.length < max && !picked.includes(a)) picked.push(a);
  return picked;
}

/** The next version's name: v1 -> v2. */
export function nextName(name: string): string {
  const match = /^v(\d+)$/.exec(name);
  return match ? `v${Number(match[1]) + 1}` : `${name}-next`;
}
