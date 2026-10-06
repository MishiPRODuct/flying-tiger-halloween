# 🎃 Flying Tiger Halloween Agent — local MVP

A buyer-side shopping agent for the **Flying Tiger Copenhagen GB storefront's Halloween collections**, built on [eve](https://eve.dev) (pinned 0.71.2). It searches the live catalog, builds a basket under the store's own rules, asks for approval, and hands off to **Flying Tiger's own checkout** via a cart permalink. **No payment code anywhere in this repo** — card data never touches this system.

Useful until **22 October 2026** (the "order by" date for Halloween delivery); after that the agent refuses delivery baskets and points to the store locator.

## Run it

```bash
# one-time: paste your key
echo 'ANTHROPIC_API_KEY=sk-ant-…' > .env

npm run dev            # terminal REPL + http://localhost:2000
```

Open **http://localhost:2000** — a mock of the Flying Tiger Club app's voucher screen (decorative, non-clickable). Tap the spinning 🎃 button on the right to open the agent chat.

**Phone on the same Wi-Fi** (localDev auth is env-gated, so LAN is fine, but the server binds loopback by default):

```bash
npm exec -- eve dev -- --host 0.0.0.0
# then open http://<laptop-ip>:2000 on the phone
```

Try: *“Trick or treat bags for 8 kids under £25, delivered by Halloween.”*
Then: *“I'm ordering on 25 October, party stuff for 10”* → expect the cutoff refusal + store locator.

## How it works

| Piece | What |
|---|---|
| `agent/instructions.md` | The store's rules: 22 Oct cutoff, free shipping ≥ £40 (never pad the basket), £115 import-duty warning, stock re-check, under-3 age rule, never invent products/prices, automated-agent disclosure |
| `agent/tools/halloween_search.ts` | Live search over the nine Halloween collections (`products.json`, 10-min cache, committed snapshot as offline fallback) |
| `agent/tools/check_rules.ts` | Deterministic rules check — pure function in `agent/lib/rules.ts`, unit-tested, reusable as the future eval judge |
| `agent/tools/hand_off_checkout.ts` | **Approval-gated.** Re-checks live stock, returns `flyingtiger.com/en-gb/cart/<variant>:<qty>` — shopper pays on the store's own page (Apple Pay etc.) or abandons |
| `agent/connections/flying-tiger.ts` | The store's official **UCP MCP endpoint** (catalog tools only). The required hosted agent profile + the empirically derived recipe: `docs/findings.md` §1 |
| `web/index.html` | The whole UI — Club-app mock + chat overlay, plain HTML/JS, no build step, served by `agent/channels/home.ts` |
| `scripts/snapshot_catalog.ts` | Frozen dated catalog → `data/halloween-<date>.json` (315 variants, 2026-10-06). Re-run: `node scripts/snapshot_catalog.ts $(date +%F)` |

Tests: `node --test agent/lib/rules.test.ts` (six edge cases from the brief: £38, £120, 25 Oct, make-up for a 2-year-old, sold-out item, impossible budget).

## Deliberately out of scope (MVP)
Payments/wallets, deploy, eval harness (20 cases × 4 models — next phase; `lib/rules.ts` is judge-ready), memory, accounts, cron. **v2 idea:** replace the chat page with the MishiPay Scan&Go webapp shell.
