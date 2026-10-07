// Config-driven store rules. Pure function — reusable by a future eval judge.
import type { BrandConfig } from "./config.ts";
import { money } from "./config.ts";

export interface BasketLine {
  variant_id: number;
  title: string;
  price: number;
  qty: number;
  in_stock: boolean;
  tags?: string[];
}

export interface RulesInput {
  order_date: string; // YYYY-MM-DD
  lines: BasketLine[];
  budget?: number;
  shopper_ages?: number[];
}

export interface RulesResult {
  passes: boolean;
  hard_fails: string[];
  warnings: string[];
  subtotal: number;
  free_shipping: boolean | null;    // null when the brand has no threshold configured
  to_free_shipping: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function checkRules(c: BrandConfig, input: RulesInput): RulesResult {
  const r = c.rules;
  const hard_fails: string[] = [];
  const warnings: string[] = [];
  const subtotal = round2(input.lines.reduce((s, l) => s + l.price * l.qty, 0));

  if (r.orderCutoffDate && input.order_date > r.orderCutoffDate) {
    hard_fails.push(
      `Ordering on ${input.order_date} is past the ${r.orderCutoffDate} cutoff.` +
        (r.cutoffMessage ? ` ${r.cutoffMessage}` : "") +
        (c.links.storeLocator ? ` Suggest the store locator: ${c.links.storeLocator}` : ""),
    );
  }

  let free_shipping: boolean | null = null;
  let to_free = 0;
  if (r.freeShippingThreshold) {
    free_shipping = subtotal >= r.freeShippingThreshold;
    to_free = free_shipping ? 0 : round2(r.freeShippingThreshold - subtotal);
    if (!free_shipping && input.lines.length > 0) {
      warnings.push(
        `Basket is ${money(c, subtotal)} — ${money(c, to_free)} below the ${money(c, r.freeShippingThreshold)} free-shipping threshold. ` +
          `Shipping is calculated at checkout. Do not add items the shopper did not ask for.`,
      );
    }
  }

  if (r.dutiesThreshold && subtotal > r.dutiesThreshold) {
    warnings.push(
      `Basket is ${money(c, subtotal)} — orders above ${money(c, r.dutiesThreshold)} may attract import duties/taxes. Warn before proceeding.`,
    );
  }

  for (const l of input.lines) {
    if (!l.in_stock) hard_fails.push(`"${l.title}" (variant ${l.variant_id}) is out of stock.`);
  }

  const youngest = input.shopper_ages?.length ? Math.min(...input.shopper_ages) : undefined;
  if (youngest !== undefined && youngest < 3 && r.ageSensitiveKeywords.length) {
    const re = new RegExp(`\\b(${r.ageSensitiveKeywords.join("|")})\\b`, "i");
    for (const l of input.lines) {
      const text = `${l.title} ${(l.tags ?? []).join(" ")}`;
      if (re.test(text)) hard_fails.push(`"${l.title}" is not suitable for a child under 3.`);
      else warnings.push(`"${l.title}": no age mark in the catalog data — suitability for under-3s is unknown. Say so.`);
    }
  }

  if (input.budget !== undefined && subtotal > input.budget) {
    hard_fails.push(`Basket total ${money(c, subtotal)} exceeds the budget of ${money(c, input.budget)}.`);
  }

  return { passes: hard_fails.length === 0, hard_fails, warnings, subtotal, free_shipping, to_free_shipping: to_free };
}
