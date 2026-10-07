import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { loadBrand, storeBase } from "../lib/config.ts";
import { getCatalog } from "../lib/catalog.ts";
import { ucpCall, summarizeCheckout, marketContext } from "../lib/ucp.ts";

// Degradation ladder: UCP create_checkout (authoritative totals + session
// pay_url) -> Shopify cart permalink. Payment always completes on the store's
// own hosted page; no payment data ever enters this system.
export default defineTool({
  description:
    "Create a checkout for the agreed basket. Re-checks live stock, then creates a native checkout via the " +
    "store's UCP API and returns line items, authoritative totals, accepted payment options, and the pay_url " +
    "the shopper opens to enter address/shipping and pay. Only call after check_rules passes and the shopper confirmed.",
  approval: once(),
  inputSchema: z.object({
    lines: z.array(z.object({ variant_id: z.number(), qty: z.number().int().positive() })).min(1),
    buyer_email: z.string().email().optional(),
  }),
  async execute({ lines, buyer_email }) {
    const c = loadBrand();
    const { items, source } = await getCatalog();
    const byId = new Map(items.map((i) => [i.variant_id, i]));
    const problems: string[] = [];
    for (const { variant_id } of lines) {
      const item = byId.get(variant_id);
      if (!item) problems.push(`Variant ${variant_id} is not in the catalog.`);
      else if (!item.in_stock) problems.push(`"${item.title}" went out of stock.`);
    }
    if (problems.length > 0) return { ok: false, problems, stock_source: source };

    try {
      const checkout = await ucpCall("create_checkout", {
        checkout: {
          line_items: lines.map((l) => ({ item: { id: `gid://shopify/ProductVariant/${l.variant_id}` }, quantity: l.qty })),
          context: marketContext(c),
          ...(buyer_email ? { buyer: { email: buyer_email } } : {}),
        },
      });
      return { ok: true, via: "ucp", ...(await summarizeCheckout(c, checkout)), stock_source: source };
    } catch (err) {
      const cart = lines.map((l) => `${l.variant_id}:${l.qty}`).join(",");
      return {
        ok: true,
        via: "permalink-fallback",
        note: `UCP checkout unavailable (${(err as Error).message.slice(0, 120)}); using cart permalink.`,
        pay_url: `${storeBase(c)}/cart/${cart}`,
        stock_source: source,
      };
    }
  },
});
