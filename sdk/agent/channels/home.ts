// Routes: GET /          -> demo shell (a fake "brand site" that uses the real embed snippet)
//         GET /widget    -> the chat page, brand config injected as window.BRAND
//         GET /embed.js  -> the snippet script, brand theme + origin injected
// fs reads are fine for local dev; inline for production builds.
import { defineChannel, GET, HEAD } from "eve/channels";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBrand } from "../lib/config.ts";

function brandClient() {
  const c = loadBrand();
  return {
    name: c.name,
    displayName: c.displayName,
    domain: c.storefront.domain,
    welcome: c.persona.welcome,
    examplePrompt: c.persona.examplePrompt,
    theme: c.theme,
  };
}

const widget = async () => {
  const html = await readFile(join(process.cwd(), "widget", "chat.html"), "utf8");
  return new Response(html.replace("/*__BRAND__*/null", JSON.stringify(brandClient())), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

const embed = async (request: Request) => {
  const js = await readFile(join(process.cwd(), "widget", "embed.js"), "utf8");
  const c = loadBrand();
  const cfg = {
    origin: new URL(request.url).origin,
    launcher: c.theme.launcher,
    accent: c.theme.accent,
    name: c.displayName,
  };
  return new Response(js.replace(/\/\*__EMBED__\*\/\s*\{[^}]*\}/, JSON.stringify(cfg)), {
    headers: { "content-type": "application/javascript; charset=utf-8" },
  });
};

const demo = async () => {
  const c = loadBrand();
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${c.displayName} — embed demo</title>
<style>body{font-family:-apple-system,sans-serif;margin:0;background:#fafafa;color:#222}
main{max-width:640px;margin:0 auto;padding:48px 24px}
h1{font-weight:800;letter-spacing:-.5px} code{background:#eee;padding:2px 6px;border-radius:6px}
.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.08);margin:16px 0}</style>
</head><body><main>
<h1>${c.displayName}</h1>
<p>This page pretends to be <b>${c.storefront.domain}</b>'s own site or app. The only integration on it is the real embed snippet:</p>
<div class="card"><code>&lt;script src="/embed.js" async&gt;&lt;/script&gt;</code></div>
<p>Tap the launcher button (bottom right) to shop with the agent. Checkout links go to the store's own hosted checkout.</p>
</main>
<script src="/embed.js" async></script>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};

export default defineChannel({
  routes: [GET("/", demo), HEAD("/", demo), GET("/widget", widget), GET("/embed.js", embed)],
});
