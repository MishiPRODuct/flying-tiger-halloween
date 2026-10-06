import { defineAgent } from "eve";
import { createAnthropic } from "@ai-sdk/anthropic";

// Direct Anthropic provider instead of eve's anthropic() helper: the key is
// user-scoped (sk-ant-usr-...), so every request must carry the
// anthropic-workspace-id header, which eve's built-in helper can't add.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  headers: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID! },
});

// Model is switched here for future evals (brief §8).
export default defineAgent({
  model: anthropic("claude-sonnet-5"),
  reasoning: "low",
});
