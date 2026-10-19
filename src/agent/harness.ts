// The harness settings as data. Each file in harnesses/ is one harness version; Phase 4 makes
// new versions by editing these fields, never the code.
import { readFileSync } from "node:fs";

export interface HarnessConfig {
  name: string; // shown in tables and traces, e.g. "v1"
  systemPrompt: string; // the standing instruction sent with every call
  toolDescriptions: {
    list_files: string;
    read_file: string;
    write_file: string;
    run_tests: string;
  };
  offerListFiles: boolean; // tell Claude the list_files tool exists?
  offerRunTests: boolean; // tell Claude the run_tests tool exists?
  maxTurns: number; // safety stop, so a confused model can't loop forever
}

/** Read a harness file and check that every field is there with the right type. */
export function loadConfig(path: string): HarnessConfig {
  const config = JSON.parse(readFileSync(path, "utf8"));
  const fail = (problem: string): never => {
    throw new Error(`${path}: ${problem}`);
  };
  if (typeof config.name !== "string") fail("name must be a string");
  if (typeof config.systemPrompt !== "string") fail("systemPrompt must be a string");
  for (const tool of ["list_files", "read_file", "write_file", "run_tests"]) {
    if (typeof config.toolDescriptions?.[tool] !== "string") fail(`toolDescriptions.${tool} must be a string`);
  }
  if (typeof config.offerListFiles !== "boolean") fail("offerListFiles must be true or false");
  if (typeof config.offerRunTests !== "boolean") fail("offerRunTests must be true or false");
  if (!Number.isInteger(config.maxTurns) || config.maxTurns < 1 || config.maxTurns > 30) fail("maxTurns must be a whole number from 1 to 30");
  return config as HarnessConfig;
}
