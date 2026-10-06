import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Flying Tiger GB store locator link — offer it when it is too late for Halloween delivery (after 2026-10-22) " +
    "or when the shopper prefers to buy in store.",
  inputSchema: z.object({}),
  async execute() {
    return { url: "https://flyingtiger.com/en-gb/pages/store-locator" };
  },
});
