import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { getCatalog } from "../lib/catalog";

// No payment happens here or anywhere in this repo. This builds a Shopify cart
// permalink on Flying Tiger's own GB storefront; the shopper pays (or abandons)
// on the store's checkout page.
export default defineTool({
  description:
    "Hand the agreed basket to Flying Tiger's own checkout. Re-checks live stock for every line, then returns " +
    "a cart link the shopper opens to pay on flyingtiger.com. Requires the shopper's approval. " +
    "Only call after check_rules passes and the shopper has confirmed the basket.",
  approval: always(),
  inputSchema: z.object({
    lines: z
      .array(
        z.object({
          variant_id: z.number().describe("Variant id from halloween_search"),
          qty: z.number().int().positive(),
        }),
      )
      .min(1),
  }),
  async execute({ lines }) {
    const { items, source } = await getCatalog();
    const byId = new Map(items.map((i) => [i.variant_id, i]));
    const problems: string[] = [];
    const checked = lines.map(({ variant_id, qty }) => {
      const item = byId.get(variant_id);
      if (!item) {
        problems.push(`Variant ${variant_id} is not in the Halloween catalog.`);
        return { variant_id, qty, title: "unknown", in_stock: false };
      }
      if (!item.in_stock) problems.push(`"${item.title}" went out of stock.`);
      return { variant_id, qty, title: item.title, price_gbp: item.price_gbp, in_stock: item.in_stock };
    });
    if (problems.length > 0) {
      return { ok: false, problems, stock_source: source };
    }
    const cart = lines.map((l) => `${l.variant_id}:${l.qty}`).join(",");
    return {
      ok: true,
      checkout_url: `https://flyingtiger.com/en-gb/cart/${cart}`,
      note: "Open this link to review totals and pay on Flying Tiger's own checkout. Items are not reserved until paid.",
      lines: checked,
      stock_source: source,
    };
  },
});
