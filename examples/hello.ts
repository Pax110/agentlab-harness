import Anthropic from "@anthropic-ai/sdk";
import * as log from "../src/shared/log.ts";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const prompt = process.argv[2] ?? "Say hi in five words";

// Haiku 4.5 prices, in dollars per million tokens
const INPUT_PRICE = 1;
const OUTPUT_PRICE = 5;

log.header("PROMPT");
log.line(prompt);

const start = Date.now();
const response = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});
const ms = Date.now() - start;

log.header("REPLY", `stop: ${response.stop_reason}`);
for (const block of response.content) {
  if (block.type === "text") log.claude(block.text);
}

const { input_tokens, output_tokens } = response.usage;
const cost = (input_tokens * INPUT_PRICE + output_tokens * OUTPUT_PRICE) / 1_000_000;
log.header("STATS", `${input_tokens} in / ${output_tokens} out · $${cost.toFixed(5)} · ${ms} ms`);

// Run with SHOW_RAW=1 to see the full response object from the API.
if (process.env.SHOW_RAW) log.dump("FULL RESPONSE", response);
