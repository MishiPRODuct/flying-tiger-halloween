import { defineAgent } from "eve";
import { createAnthropic } from "@ai-sdk/anthropic";
import { loadBrand } from "./lib/config.ts";

// Direct provider so we can send the anthropic-workspace-id header
// (required by user-scoped sk-ant-usr keys; harmless otherwise).
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  headers: process.env.ANTHROPIC_WORKSPACE_ID
    ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
    : {},
});

export default defineAgent({
  model: anthropic(loadBrand().model.id),
  reasoning: "low",
});
