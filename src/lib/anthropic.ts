import { Anthropic } from "@anthropic-ai/sdk";

const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicKey) {
  throw new Error("Missing Anthropic API key (ANTHROPIC_API_KEY)");
}

const anthropicClient = new Anthropic({ apiKey: anthropicKey });

export default anthropicClient;
