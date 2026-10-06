import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

// Model is switched here for future evals (brief §8). Direct Anthropic key via .env.
export default defineAgent({
  model: anthropic("claude-sonnet-5"),
  reasoning: "low",
});
