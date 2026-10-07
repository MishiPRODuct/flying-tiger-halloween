import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadBrand } from "../lib/config.ts";
import { getCatalog, searchItems } from "../lib/catalog.ts";

export default defineTool({
  description:
    "Search the store's live catalog (public Shopify data, 10-min cache). Returns prices in the store " +
    "currency, live stock flags, and image URLs. Only items returned by this tool may be quoted to the shopper.",
  inputSchema: z.object({
    query: z.string().min(1),
    max_price: z.number().positive().optional(),
    include_out_of_stock: z.boolean().optional().default(false),
    limit: z.number().int().min(1).max(30).optional().default(12),
  }),
  async execute({ query, max_price, include_out_of_stock, limit }) {
    const c = loadBrand();
    const { items, source } = await getCatalog();
    const results = searchItems(items, query, { maxPrice: max_price, includeOutOfStock: include_out_of_stock }).slice(0, limit);
    return {
      source,
      currency: c.storefront.market.currency,
      count: results.length,
      results: results.map((i) => ({
        variant_id: i.variant_id,
        title: i.title,
        price: i.price,
        in_stock: i.in_stock,
        url: i.url,
        image: i.image ? `${i.image.split("?")[0]}?width=520` : null,
      })),
    };
  },
});
