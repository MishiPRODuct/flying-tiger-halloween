import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadBrand } from "../lib/config.ts";
import { checkRules } from "../lib/rules.ts";

export default defineTool({
  description:
    "Deterministically check a proposed basket against this store's configured rules (order cutoff, " +
    "free-shipping threshold, duties threshold, stock, age suitability, budget). Run before offering checkout.",
  inputSchema: z.object({
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Omit for today"),
    lines: z.array(
      z.object({
        variant_id: z.number(),
        title: z.string(),
        price: z.number(),
        qty: z.number().int().positive(),
        in_stock: z.boolean(),
        tags: z.array(z.string()).optional(),
      }),
    ),
    budget: z.number().positive().optional(),
    shopper_ages: z.array(z.number()).optional(),
  }),
  async execute(input) {
    const order_date = input.order_date ?? new Date().toISOString().slice(0, 10);
    return checkRules(loadBrand(), { ...input, order_date });
  },
});
