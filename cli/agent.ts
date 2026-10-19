// Run the agent once on one task, with full output.
//   npx tsx --env-file=.env.local cli/agent.ts tasks/01-sum                       (harnesses/v1.json)
//   npx tsx --env-file=.env.local cli/agent.ts tasks/01-sum harnesses/no-run-tests.json
import { resolve } from "node:path";
import { loadConfig } from "../src/agent/harness.ts";
import * as log from "../src/shared/log.ts";
import { solve } from "../src/agent/solve.ts";

const taskDir = resolve(process.argv[2] ?? "tasks/01-sum");
const config = loadConfig(process.argv[3] ?? "harnesses/v1.json");

// Run with SHOW_RAW=1 to print each full API response.
const result = await solve(taskDir, config, { showResponses: Boolean(process.env.SHOW_RAW) });

// Run with SHOW_MESSAGES=1 to dump the whole conversation at the end.
if (process.env.SHOW_MESSAGES) log.dump("MESSAGES", result.messages);
