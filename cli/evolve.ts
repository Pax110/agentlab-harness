// Phase 4: several evolve rounds from a harness version (see docs/phase4-plan.md).
//   npx tsx --env-file=.env.local cli/evolve.ts harnesses/v3.json --rounds 2 --proposer claude
//   npx tsx --env-file=.env.local cli/evolve.ts harnesses/v3.json --rounds 2 --proposer random
//   options: --k 3 (attempts per task) · --budget 2 (dollars for the whole run)
//            --baseline <results.json> (reuse saved scores of the start harness; may be given several times)
import { parseArgs } from "node:util";
import { loadConfig } from "../src/agent/harness.ts";
import { evolveRun } from "../src/evolve/evolve.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rounds: { type: "string", default: "1" },
    proposer: { type: "string", default: "claude" },
    k: { type: "string", default: "3" },
    budget: { type: "string", default: "2" },
    baseline: { type: "string", multiple: true },
  },
});
const proposer = values.proposer;
if (proposer !== "claude" && proposer !== "random") throw new Error(`--proposer must be claude or random, not ${proposer}`);

await evolveRun({
  start: loadConfig(positionals[0] ?? "harnesses/v1.json"),
  rounds: Number(values.rounds),
  proposer,
  k: Number(values.k),
  budget: Number(values.budget),
  baselines: values.baseline ?? [],
});
