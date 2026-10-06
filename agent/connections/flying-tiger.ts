// Flying Tiger's published UCP shopping endpoint (MCP transport, spec 2026-08-25).
// Catalog tools only for the MVP: cart/checkout need Shop-Accounts OAuth identity
// linking, and complete_checkout would place a real order.
//
// Every UCP call must carry meta.ucp-agent.profile — a publicly hosted agent
// profile that Shopify fetches and validates server-side. Ours is a public gist
// (revision-pinned; served as application/json via githack). providedArguments
// injects it app-side, so the model never sees or controls it.
// NOTE: prices in results are integers in ISO 4217 MINOR units (450 = £4.50).
import { defineMcpClientConnection } from "eve/connections";

const AGENT_PROFILE_URL =
  "https://gist.githack.com/MishiPRODuct/ea2ec206a465e6d91bd6414d3874013e/raw/327d836585c1a101484d4ac8513688faab37924f/ucp.json";

export default defineMcpClientConnection({
  url: "https://ftc-row.myshopify.com/api/ucp/mcp",
  description:
    "Flying Tiger Copenhagen's official UCP shopping API (live catalog). Use search_catalog / get_product " +
    "for live product detail. Always pass catalog.context {address_country:'GB', language:'en-GB', currency:'GBP'}. " +
    "Prices come back in PENCE (minor units): divide amount by 100 for £.",
  tools: { allow: ["search_catalog", "lookup_catalog", "get_product"] },
  toolCall: {
    providedArguments: {
      meta: { "ucp-agent": { profile: AGENT_PROFILE_URL } },
    },
  },
});
