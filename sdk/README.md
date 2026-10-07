# 🛍️ UCP Shopping-Agent SDK (experiment)

Turn any UCP-enabled store (every Shopify store serves `/.well-known/ucp`) into a **brand-owned shopping agent** — embedded in the brand's own site or app, speaking the brand's tone, enforcing the brand's trading rules, checking out on the brand's own hosted checkout.

This generalizes the [Flying Tiger Halloween MVP](../README.md) (which stays untouched at the repo root): everything brand-specific became one JSON file. Proven on two live stores the same afternoon — **Flying Tiger GB** (scoped collections + trading rules) and **MUJI US** (full catalog, onboarded with zero prior knowledge by one probe command).

## What the brand does — the entire integration

Imagine ABC store, on Shopify:

1. **Tells us their storefront domain** (plus optional brand rules, tone, colors).
2. **Pastes one snippet** where the agent should appear:
   ```html
   <script src="https://abc.agents.example.com/embed.js" async></script>
   ```
   Website: one line in `theme.liquid`, or via Google Tag Manager (zero deploy). App: same snippet in the webview, or open `/widget` in an in-app browser sheet.
3. **Done.** A launcher button in their colors appears; shoppers chat, build baskets, and tap through to ABC's own hosted checkout — orders land in ABC's normal Shopify admin, payments, and fulfilment untouched.

What ABC does **not** do: no Shopify app install, no admin API token, no backend work, no PCI/payment changes, no catalog export. We read the store's public UCP/`products.json` surface. Caveat: the agent sees what an anonymous shopper sees (no logged-in pricing/loyalty — that's a v2 integration).

## Onboard a brand in 3 commands

```bash
node scripts/init.ts www.muji.us muji-us   # probes /.well-known/ucp + products.json → brands/muji-us.json draft
# review brands/muji-us.json (rules, tone, theme)
BRAND=muji-us npm run dev                  # renders instructions.md from the config, boots the agent
# open http://localhost:2000  →  a demo host page using the real embed snippet
```

## Architecture

```
brands/<name>.json ──render.ts──▶ agent/instructions.md       (brand rules & persona → system prompt)
                   ──config.ts──▶ tools read it at runtime    (search scope, rules, market, links)
                   ──home.ts────▶ /widget theme + /embed.js   (colors, launcher, welcome)

agent/lib/ucp.ts      UCP discovery (/.well-known/ucp → MCP endpoint) + shared hosted agent profile
agent/lib/catalog.ts  public products.json (store-wide or per-collection), 10-min cache
agent/lib/rules.ts    config-driven trading rules — pure, unit-tested (npm test)
agent/tools/          product_search · check_rules · checkout (approval-gated) · store_info
widget/               chat.html (themed via window.BRAND) · embed.js (launcher + iframe)
```

**Degradation ladder:** UCP `create_checkout` (authoritative totals + session `pay_url`) → Shopify cart permalink → catalog-only. Payment always completes on the store's hosted checkout — that's how Shopify's UCP works for every agent today (verified: address/shipping input is accepted then discarded; `requires_escalation`). No payment data ever enters this system.

## BrandConfig reference

See `agent/lib/config.ts` (zod schema) — `brands/flying-tiger.json` shows a fully-loaded config (collection scoping, cutoff date, thresholds, age rules), `brands/muji-us.json` a minimal one (full catalog, no rules).

## Status / limitations

- Local-dev MVP: widget/embed served via fs reads (inline for production builds); auth is eve's localDev (add a real AuthFn before deploying).
- One deployment per brand (`BRAND` env at boot). Multi-tenant is a non-goal for now.
- Anonymous-shopper view only; no loyalty/account context yet.
- Unit cost ≈ $0.10/basket on claude-sonnet-5; ~3× cheaper on Haiku. Model is per-brand config.
