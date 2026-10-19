# agentlab-harness

A hands-on, from-scratch build of an **LLM agent harness** (the code around a model that lets it act on a task) and of a loop in which the **harness improves itself** while the model stays frozen. Written in TypeScript, with Claude (Haiku 4.5) as the model and a small, validated suite of bug-fixing tasks graded by hidden tests.

The project follows the framing of *From Question Answering to Task Completion: A Survey on Agent System and Harness Design* (Guo et al., 2026): an agent is a **model–harness pair**, so the same model can perform very differently depending on its harness. Everything here is built without an agent framework, so every part of the harness is visible and small enough to read.

## Results at a glance
All numbers: Claude Haiku 4.5, 14 tasks, 3 attempts per task (k = 3), pass/fail decided by a hidden grader the agent never sees.

**Same model, different harness.** Removing a single tool from the harness, `run_tests` (the agent can run the project's visible tests), changes the pass rate on 10 tasks:

| Harness | Passed |
|---|---|
| with `run_tests` | 21 / 30 (70%) |
| without `run_tests` | 16 / 30 (53%) |

**A self-improving harness.** Claude reads the failures on 6 training tasks and proposes a new system prompt; a candidate is kept only if it does better on 8 held-out tasks it never saw. A random-tip proposer is the control.

| Version | Made by | Train (18) | Held-out (24) | $ / attempt | Decision |
|---|---|---|---|---|---|
| v3 | starting harness | 10 | 9 | 0.0142 | — |
| **v5** | Claude | **13** | **12** | 0.0154 | **kept (best)** |
| v6 | Claude, from v5 | 15 | 11 | 0.0153 | discarded |
| v7 | random tip | 12 | 9 | 0.0146 | discarded |
| v8 | random tip (same prompt as v7) | 11 | 10 | 0.0143 | kept, within noise |

What this shows:
- **Informed proposals beat random ones, modestly** (+3 held-out vs +1).
- **Noise is about ±1–2 passes at k = 3**: the identical prompt scored 9 and 10. A +1 keep threshold is too small.
- **Proposals overfit to training tasks** (hints copied from them); the held-out split caught it (v6: train up, held-out down → discarded).
- **The dominant failure** is "visible tests pass, a rule written only in a code comment is missed". Better prompts raise the chance of catching it, but don't make it reliable: 4 of 5 improvable held-out tasks barely moved.

Every version tried is recorded in `lineage/` with its prompt, reason, scores and decision.

**All four phases on the same tasks.** Same model, 14 tasks, k = 3, same hidden graders. Phase 3 is the hand-built harness (v3), Phase 4 its best evolved version (v5).

| Method | Train (18) | Held-out (24) | All (42) | $ / attempt |
|---|---|---|---|---|
| Phase 1, zero-shot | 9 | 11 | 20 | 0.0032 |
| Phase 1, few-shot | 11 | 11 | 22 | 0.0033 |
| **Phase 1, chain-of-thought** | 12 | **16** | **28** | 0.0042 |
| Phase 1, self-consistency (5 votes) | 9 | 12 | 21 | 0.0160 |
| Phase 2, Agentless-style workflow | 7 | 10 | 17 | 0.0104 |
| Phase 3, agent loop (v3) | 10 | 9 | 19 | 0.0142 |
| Phase 4, evolved harness (v5) | 13 | 12 | 25 | 0.0154 |

The paper's expected ordering (Phase 1 ≤ 2 ≤ 3) does **not** hold on this suite, and the reasons are instructive:
- **A weak verifier misleads the agent.** In the loop, the agent tends to make a minimal patch, sees the *visible* tests pass and stops; those tests don't cover the rules written in code comments. Phase 1 never gets that early "green" signal and rewrites the whole function from the full file. On 12-top-words, Phase 3 passed 0/3 and every Phase 1 variant 3/3.
- **One instruction mattered most.** The chain-of-thought prompt asks to reason about "what the code must do according to its comments and tests, and every case the fix must handle", which targets this suite's main trap; it alone solved 10-inventory (3/3). (The baselines don't store the answer text, so this is inferred from which tasks it solved.) The Phase 4 proposer never found an instruction this direct.
- **Localization can hide the spec.** Phase 2 picked only the implementation file, so on tasks whose rules live in the test file (02-slugify) it never saw them (0/3).
- **Cost:** the single-call Phase 1 variants are 3–5× cheaper per attempt than the agent, which resends a growing conversation every turn.

Takeaway: on small, fully-visible projects, the harness's verification signal matters more than its ability to act. A natural next experiment is to give the Phase 3 agent the same comment-focused instruction and a stronger verifier.

## What's inside
| Paradigm (from the paper) | What it means here | Status |
|---|---|---|
| 1. Prompt engineering | one answer, no tools: zero-shot, few-shot, chain-of-thought, self-consistency | built and measured |
| 2. Workflow + context engineering | a fixed, Agentless-style pipeline: localize from a repo map → 3 repairs → majority vote; never runs code | built and measured |
| 3. Harness engineering | the agent loop: Claude chooses each step, our code executes tools and reports back | built and measured |
| 4. Harness co-evolution | trace-driven proposals to the harness, kept only if they generalize | built and measured |

## How it works

### The agent loop (Phase 3)
```
copy the task's code into a fresh workspace
loop (up to maxTurns):
   send system prompt + tools + whole conversation to Claude
   Claude replies with text and/or tool calls (list_files, read_file, write_file, run_tests)
   our code runs each tool inside the workspace and sends the results back
   stop when Claude asks for no more tools
grade with the hidden grader → PASS/FAIL · write trace.jsonl and summary.md
```
The model only *proposes* actions; the harness decides how they are executed, what the model sees back, and when to stop.

### The six harness components
The survey describes a harness as H = ⟨I_obs, C, L, I_act, S, V⟩. In this repo:

| Component | Here | Where |
|---|---|---|
| I_act, actions | `list_files`, `read_file`, `write_file`, `run_tests` | `src/agent/solve.ts` |
| I_obs, observations | tool results returned to the model | `src/agent/solve.ts` |
| C, context | system prompt + the whole conversation | `harnesses/*.json`, `src/agent/solve.ts` |
| L, control loop | act → observe until no tool call or `maxTurns` | `src/agent/solve.ts` |
| S, state | a fresh copy of the task's code per attempt | `src/agent/solve.ts` |
| V, verification and safety | workspace confinement for every path, turn limit, visible tests | `src/agent/solve.ts` |

Each component is deliberately minimal; the limitations below list what is still missing.

### Harness versions are data
The settings that define a harness live in a JSON file, one per version, so a new harness is a new file, not new code:
```json
{
  "name": "v3",
  "systemPrompt": "You are fixing code in a small project. ...",
  "toolDescriptions": { "list_files": "...", "read_file": "...", "write_file": "...", "run_tests": "..." },
  "offerListFiles": true,
  "offerRunTests": true,
  "maxTurns": 10
}
```
Every trace records the full harness version that produced it.

### Evaluation
- **Tasks** (`tasks/<id>/`): a small JavaScript project with a bug (`repo/`), a bug report (`task.md`), visible tests the agent may run, a **hidden grader** (`check.js`, never copied into the workspace) and a **reference fix** (`reference/`). Most tasks hide a trap: the bug is in a different file than the symptom, a rule is stated only in a code comment, there are several bugs, or the file is long.
- **Validation** (`npm run validate`, free): for every task, the buggy code must fail both the visible tests and the grader, and the reference fix must pass both.
- **Split** (`split.json`): 6 training tasks (their failures may be shown to the proposer) and 8 held-out tasks (used only to judge).
- **Repeats**: each task runs k = 3 times, because the agent is not deterministic.
- **Records**: every attempt writes `trace.jsonl` (every model call and tool call, with tokens and timing) and a readable `summary.md`.

### Harness evolution (Phase 4)
```
current harness ── score on train + held-out ──► failure report (rules over TRAIN traces only)
                                                       │
                     proposer (Claude, or a random tip) writes ONE new system prompt
                                                       │
         candidate ── score on train + held-out ──► keep if: held-out ≥ +1 · train not lower · cost ≤ 1.5×
```
- The proposer never sees held-out failures, graders or task files. Its answer comes back through a forced tool call (structured output), is checked against guardrails (no task or file names, length cap) and is retried with feedback if rejected.
- Every candidate, kept or not, is recorded in `lineage/` with its prompt, reason, predicted and actual scores, and the decision.
- Each run writes a `report.md` with the evidence, proposal, before/after table and every check.

### Baselines (Phases 1–2)
Same tasks, split and graders as Phases 3–4; neither ever runs code while solving.
- **Phase 1** (`src/baselines/phase1.ts`): one Claude call with the instruction and every file; it answers once with the fixed file(s). Variants: zero-shot, few-shot (one worked example), chain-of-thought (reason first), self-consistency (5 answers, majority vote).
- **Phase 2** (`src/baselines/phase2.ts`): our code runs fixed steps. Localize (Claude picks files from a repo map of files and signatures), repair (3 independent fixes from just those files), rank (majority vote).

## Getting started
Requirements: Node.js 22, an Anthropic API key.
```bash
npm install
cp .env.example .env.local      # then put your key in .env.local (git-ignored)
npm run validate                # free: checks every task
```

| Command | What it does | Cost (Haiku 4.5) |
|---|---|---|
| `npm run validate` | check every task is fair | free |
| `npm run check-offline` | check the baselines' answer → apply → grade path | free |
| `npm run typecheck` | type-check everything | free |
| `npm run agent -- tasks/01-sum harnesses/v5.json` | one attempt with full output (`SHOW_RAW=1` / `SHOW_MESSAGES=1` for more) | ~$0.01 |
| `npm run run-tasks -- 3 harnesses/v3.json harnesses/v5.json` | compare harness versions (add `train`, `heldout` or task names to narrow) | ~$0.65 per version |
| `npm run evidence -- runs/run-<time> train` | failure report for a run | free |
| `npm run propose -- runs/run-<time> harnesses/v3.json` | one proposal, not tested | ~$0.01 |
| `npm run evolve -- harnesses/v5.json --rounds 2 --proposer claude` | Phase 4 rounds (`--k`, `--budget`, `--baseline`) | ~$0.65 per round |
| `npm run baselines -- p1-zero-shot 3` | a Phase 1/2 baseline | see the baselines doc |

Runs call the Anthropic API and cost money; outputs go to `runs/` (git-ignored). Each run ends with clickable paths to its report, summaries and traces.

## Repository layout
```
src/             the logic (only imported, never run directly)
  shared/        log.ts (console output) · trace.ts (trace.jsonl)
  agent/         solve.ts (agent loop, tools, grading) · harness.ts (harness versions as data)
  measure/       evaluate.ts (score a harness) · summary.ts (summary.md) · evidence.ts (failure rules)
  evolve/        propose.ts (proposer) · evolve.ts (Phase 4 rounds)
  baselines/     common.ts · phase1.ts · phase2.ts
cli/             the commands: read arguments, call src/, print
harnesses/       harness versions (v1, v3, v5 = best, ...)
tasks/           the task suite
split.json       train / held-out tasks
lineage/         every harness version tried, with reasons, scores and decisions
examples/        hello.ts (a single API call)
```

## Extending
- **Add a task:** create `tasks/<id>/` with `repo/` (code + `*.test.js`), `task.md`, `check.js` and `reference/`; add the id to `split.json`; run `npm run validate`.
- **Add a harness version:** copy a file in `harnesses/`, change its fields, compare it with `npm run run-tasks`.
- **Add a tool:** define it and its handler in `src/agent/solve.ts` (`runTool`), add its description to the harness files, and an `offer…` switch if it should be optional.

## Limitations and next steps
- Small task suite (14 tasks) and k = 3: differences of 1–2 passes are noise.
- One model (Claude Haiku 4.5); the proposer only edits the system prompt.
- The guardrail blocks task names but not task-specific *meaning*.
- Attempts run one at a time (a full comparison takes about 10 minutes per harness version).
- No sandbox: the agent's tools are confined to a workspace folder, but `run_tests` executes the project's code on the host.
- The tasks are small enough to fit in one prompt, which favours Phase 1; larger projects should shift the balance toward the agent.
- Next: the comment-focused instruction and a stronger verifier for the agent, held-out tasks nobody has inspected, a keep threshold above the noise, more harness components (output trimming, context compaction, checkpoints, a permission gate).

## Acknowledgements
Built with the help of Claude Code. The framing and the harness model H = ⟨I_obs, C, L, I_act, S, V⟩ come from Guo et al., 2026, *From Question Answering to Task Completion: A Survey on Agent System and Harness Design*.

## License
[MIT](LICENSE)
