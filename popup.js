const $ = id => document.getElementById(id);
const TEST_URLS = ["https://www.gstatic.com/generate_204", "https://example.com"];

function send(type, config) {
  return chrome.runtime.sendMessage(config === undefined ? { type } : { type, config });
}

function readForm() {
  return {
    scheme: $("scheme").value,
    host: $("host").value.trim(),
    port: Number($("port").value),
    username: $("username").value.trim(),
    password: $("password").value,
  };
}

function setMessage(text, kind) {
  const el = $("message");
  el.textContent = text;
  el.classList.toggle("ok", kind === "ok");
  el.classList.toggle("error", kind === "error");
}

function updateAuthFields(scheme) {
  const supported = scheme === "http" || scheme === "https";
  $("username").disabled = !supported;
  $("password").disabled = !supported;
  $("authHint").hidden = supported;
}

function render(c) {
  $("scheme").value = c.scheme || "socks5";
  $("host").value = c.host || "";
  $("port").value = c.port || 1080;
  $("username").value = c.username || "";
  $("password").value = "";
  const on = Boolean(c.enabled);
  $("toggle").setAttribute("aria-pressed", String(on));
  $("toggle").classList.toggle("on", on);
  $("status").textContent = on ? "Connected" : "Disconnected";
  updateAuthFields($("scheme").value);
}

// Requests made after the proxy is applied go through it, so a successful
// fetch proves the endpoint is reachable and routing works end to end.
async function testProxy() {
  for (const url of TEST_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      clearTimeout(timer);
    }
  }
  return false;
}

async function connect() {
  const config = { ...readForm(), enabled: true };
  if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    setMessage("Enter a valid proxy host and port (1\u201365535).", "error");
    return;
  }
  const result = await send("setConfig", config);
  if (result?.error) {
    setMessage(result.error, "error");
    return;
  }
  setMessage("Connecting\u2026");
  // Let the browser apply the new proxy before testing it, then retry a few
  // times so a slow-to-wake endpoint (or a laptop just back from sleep) is not
  // reported as down.
  await new Promise(resolve => setTimeout(resolve, 400));
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    if (attempt > 0) {
      setMessage("Endpoint not responding \u2014 retrying (" + attempt + "/2)\u2026");
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    ok = await testProxy();
  }
  if (ok) setMessage("Connected \u2014 connectivity check passed.", "ok");
  else setMessage("Not connected \u2014 the endpoint did not respond. Check the host and port, and that the endpoint is running.", "error");
}

async function disconnect() {
  await send("disconnect");
  setMessage("Disconnected.");
}

$("toggle").addEventListener("click", async () => {
  const current = await send("getConfig");
  if (current.enabled) await disconnect();
  else await connect();
  await load();
});

["scheme", "host", "port", "username", "password"].forEach(id =>
  $(id).addEventListener("change", async () => {
    const current = await send("getConfig");
    if (current.enabled) {
      await send("setConfig", { ...readForm(), enabled: true });
      setMessage("Proxy settings updated.");
    }
  })
);

$("scheme").addEventListener("change", () => updateAuthFields($("scheme").value));

async function load() {
  const c = await send("getConfig");
  render(c);
  if (c.enabled && !c.applied) setMessage("Proxy is enabled but was not applied by the browser.", "error");
}

load().catch(e => setMessage(e.message, "error"));