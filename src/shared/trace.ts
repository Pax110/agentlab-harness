// Trace file: everything that happened in one attempt, one JSON event per line (JSONL).
import type Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, readFileSync } from "node:fs";
import type { HarnessConfig } from "../agent/harness.ts";

/** Every kind of event in a trace. The `type` field tells them apart. */
export type TraceEvent =
  | {
      type: "start";
      task: string;
      model: string;
      harness: HarnessConfig; // the full harness version used for this attempt
      instruction: string;
    }
  | {
      type: "model_call";
      turn: number;
      stopReason: string | null;
      inputTokens: number;
      outputTokens: number;
      ms: number;
      content: Anthropic.ContentBlock[]; // Claude's text and tool requests
    }
  | {
      type: "tool_call";
      turn: number;
      name: string;
      input: unknown;
      output: string;
      isError: boolean;
      ms: number;
    }
  | {
      type: "end";
      passed: boolean;
      graderOutput: string;
      turns: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      seconds: number;
      diff: string;
    };

/** Add one event as a line at the end of the trace file, stamped with the time. */
export function appendEvent(path: string, event: TraceEvent): void {
  appendFileSync(path, JSON.stringify({ time: new Date().toISOString(), ...event }) + "\n");
}

// One name per event kind. Extract<Union, Shape> picks the union member(s) matching Shape.
export type StartEvent = Extract<TraceEvent, { type: "start" }>;
export type ModelCallEvent = Extract<TraceEvent, { type: "model_call" }>;
export type ToolCallEvent = Extract<TraceEvent, { type: "tool_call" }>;
export type EndEvent = Extract<TraceEvent, { type: "end" }>;

/** Read a trace file back into a list of events. */
export function readTrace(path: string): TraceEvent[] {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as TraceEvent);
}
