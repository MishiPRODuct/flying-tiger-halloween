// Deterministic Flying Tiger GB Halloween rules (brief §5, rules 1–5).
// Pure function: used by the check_rules tool now and by the eval judge later.

export const RULES = {
  deliveryCutoff: "2026-10-22",
  freeShippingThresholdGbp: 40,
  importDutiesThresholdGbp: 115,
  storeLocatorUrl: "https://flyingtiger.com/en-gb/pages/store-locator",
} as const;

export interface BasketLine {
  variant_id: number;
  title: string;
  price_gbp: number;
  qty: number;
  in_stock: boolean;
  tags?: string[];
}

export interface RulesInput {
  order_date: string; // YYYY-MM-DD, the date the shopper is ordering
  lines: BasketLine[];
  budget_gbp?: number;
  shopper_ages?: number[]; // ages of the people the items are for
}

export interface RulesResult {
  passes: boolean;
  hard_fails: string[];
  warnings: string[];
  subtotal_gbp: number;
  free_shipping: boolean;
  gbp_to_free_shipping: number;
}

const AGE_SENSITIVE = /\b(make-?up|face paint|fake blood|glitter gel|nail|tattoo)\b/i;

export function checkRules(input: RulesInput): RulesResult {
  const hard_fails: string[] = [];
  const warnings: string[] = [];

  const subtotal = round2(
    input.lines.reduce((s, l) => s + l.price_gbp * l.qty, 0),
  );

  // Rule 1 — delivery cutoff. String compare is safe for ISO dates.
  if (input.order_date > RULES.deliveryCutoff) {
    hard_fails.push(
      `Ordering on ${input.order_date} is past the ${RULES.deliveryCutoff} cutoff for delivery before Halloween. ` +
        `Suggest the store locator: ${RULES.storeLocatorUrl}`,
    );
  }

  // Rule 2 — free shipping threshold.
  const freeShipping = subtotal >= RULES.freeShippingThresholdGbp;
  const toFree = freeShipping
    ? 0
    : round2(RULES.freeShippingThresholdGbp - subtotal);
  if (!freeShipping && input.lines.length > 0) {
    warnings.push(
      `Basket is £${subtotal.toFixed(2)} — £${toFree.toFixed(2)} below the £${RULES.freeShippingThresholdGbp} ` +
        `free-shipping threshold. Shipping cost is calculated at checkout (not published). ` +
        `Do not add items the shopper did not ask for.`,
    );
  }

  // Rule 3 — import duties threshold.
  if (subtotal > RULES.importDutiesThresholdGbp) {
    warnings.push(
      `Basket is £${subtotal.toFixed(2)} — UK orders above £${RULES.importDutiesThresholdGbp} may attract import duties and taxes. Warn before proceeding.`,
    );
  }

  // Rule 4 — stock (items are never reserved; caller must pass fresh stock flags).
  for (const l of input.lines) {
    if (!l.in_stock) {
      hard_fails.push(`"${l.title}" (variant ${l.variant_id}) is out of stock.`);
    }
  }

  // Rule 5 — age suitability.
  const youngest = input.shopper_ages?.length
    ? Math.min(...input.shopper_ages)
    : undefined;
  if (youngest !== undefined && youngest < 3) {
    for (const l of input.lines) {
      const text = `${l.title} ${(l.tags ?? []).join(" ")}`;
      if (AGE_SENSITIVE.test(text)) {
        hard_fails.push(
          `"${l.title}" is not suitable for a child under 3 (make-up / fake blood / similar).`,
        );
      } else {
        warnings.push(
          `"${l.title}": no age mark in the catalog data — age suitability for a child under 3 is unknown. Say so.`,
        );
      }
    }
  }

  // Budget (used by the eval judge; a basket over budget is a hard fail).
  if (input.budget_gbp !== undefined && subtotal > input.budget_gbp) {
    hard_fails.push(
      `Basket total £${subtotal.toFixed(2)} exceeds the budget of £${input.budget_gbp.toFixed(2)}.`,
    );
  }

  return {
    passes: hard_fails.length === 0,
    hard_fails,
    warnings,
    subtotal_gbp: subtotal,
    free_shipping: freeShipping,
    gbp_to_free_shipping: toFree,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
