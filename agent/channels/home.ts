// Replaces eve's default home page: serves the Flying Tiger Club mock + chat
// overlay at GET /. Read per request so edits to web/index.html hot-reload.
// Local-dev only (fs read is not traced into production bundles).
import { defineChannel, GET, HEAD } from "eve/channels";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const respond = async () => {
  const html = await readFile(join(process.cwd(), "web", "index.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

export default defineChannel({
  routes: [GET("/", respond), HEAD("/", respond)],
});
