import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadBrand, storeBase } from "../lib/config.ts";

export default defineTool({
  description: "The store's useful links: homepage, store locator, help — offer when relevant (e.g. after an order cutoff, or for returns questions).",
  inputSchema: z.object({}),
  async execute() {
    const c = loadBrand();
    return { store: storeBase(c), store_locator: c.links.storeLocator, help: c.links.help };
  },
});
