// The brand's entire integration: <script src="https://<agent>/embed.js" async></script>
// Injects a themed launcher button + an iframe to the agent's /widget page.
(() => {
  var CFG = /*__EMBED__*/ { origin: "", launcher: "🛍️", accent: "#111111", name: "Shopping assistant" };
  var origin = CFG.origin || new URL(document.currentScript.src).origin;

  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Open " + CFG.name);
  btn.textContent = CFG.launcher;
  btn.style.cssText =
    "position:fixed;right:18px;bottom:18px;z-index:2147483000;width:64px;height:64px;border-radius:50%;" +
    "border:none;cursor:pointer;font-size:30px;background:" + CFG.accent + ";" +
    "box-shadow:0 6px 24px rgba(0,0,0,.28);transition:transform .15s";
  btn.onmouseenter = function () { btn.style.transform = "scale(1.08)"; };
  btn.onmouseleave = function () { btn.style.transform = "scale(1)"; };

  var frame = document.createElement("iframe");
  frame.src = origin + "/widget";
  frame.title = CFG.name;
  frame.allow = "clipboard-write";
  frame.style.cssText =
    "position:fixed;z-index:2147483001;border:none;display:none;background:#fff;" +
    "box-shadow:0 12px 48px rgba(0,0,0,.3);border-radius:20px;" +
    "right:18px;bottom:92px;width:400px;height:680px;max-height:calc(100vh - 110px)";

  function mobile() { return window.innerWidth < 520; }
  function layout() {
    if (mobile()) {
      frame.style.right = "0"; frame.style.bottom = "0"; frame.style.width = "100vw";
      frame.style.height = "100dvh"; frame.style.maxHeight = "100dvh"; frame.style.borderRadius = "0";
    } else {
      frame.style.right = "18px"; frame.style.bottom = "92px"; frame.style.width = "400px";
      frame.style.height = "680px"; frame.style.maxHeight = "calc(100vh - 110px)"; frame.style.borderRadius = "20px";
    }
  }
  var open = false;
  function toggle(to) {
    open = to === undefined ? !open : to;
    layout();
    frame.style.display = open ? "block" : "none";
    btn.style.display = open && mobile() ? "none" : "block";
  }
  btn.onclick = function () { toggle(); };
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ucp-agent:close") toggle(false);
  });
  window.addEventListener("resize", function () { if (open) layout(); });

  document.body.appendChild(btn);
  document.body.appendChild(frame);
})();
