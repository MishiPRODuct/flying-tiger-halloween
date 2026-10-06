import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkRules } from "../lib/rules";

export default defineTool({
  description:
    "Deterministically check a proposed basket against Flying Tiger GB store rules: the 2026-10-22 delivery " +
    "cutoff, £40 free-shipping threshold, £115 import-duties warning, stock, age suitability, and budget. " +
    "Run this before offering checkout hand-off.",
  inputSchema: z.object({
    order_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Date the shopper is ordering (YYYY-MM-DD). Omit for today."),
    lines: z.array(
      z.object({
        variant_id: z.number(),
        title: z.string(),
        price_gbp: z.number(),
        qty: z.number().int().positive(),
        in_stock: z.boolean(),
        tags: z.array(z.string()).optional(),
      }),
    ),
    budget_gbp: z.number().positive().optional(),
    shopper_ages: z.array(z.number()).optional().describe("Ages of the people the items are for"),
  }),
  async execute(input) {
    const order_date = input.order_date ?? new Date().toISOString().slice(0, 10);
    return checkRules({ ...input, order_date });
  },
});
