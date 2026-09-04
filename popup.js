const $ = id => document.getElementById(id);

async function send(type, config) {
  return chrome.runtime.sendMessage(config === undefined ? { type } : { type, config });
}

function readForm() {
  return { scheme: $("scheme").value, host: $("host").value.trim(), port: Number($("port").value) };
}

function render(c) {
  $("scheme").value = c.scheme || "http";
  $("host").value = c.host || "127.0.0.1";
  $("port").value = c.port || 8080;
  const on = Boolean(c.enabled);
  $("toggle").setAttribute("aria-pressed", String(on));
  $("toggle").classList.toggle("on", on);
  $("status").textContent = on ? "Connected" : "Disconnected";
}

async function load() { const c = await send("getConfig"); render(c); }

$("toggle").addEventListener("click", async () => {
  const current = await send("getConfig");
  if (current.enabled) { await send("disconnect"); $("message").textContent = "Proxy disconnected."; }
  else {
    const config = { ...readForm(), enabled: true };
    if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
      $("message").textContent = "Enter a valid host and port."; return;
    }
    const result = await send("setConfig", config);
    $("message").textContent = result?.error || "Proxy connected.";
  }
  await load();
});

["scheme", "host", "port"].forEach(id => $(id).addEventListener("change", async () => {
  const current = await send("getConfig");
  if (current.enabled) await send("setConfig", { ...readForm(), enabled: true });
}));

load().catch(e => { $("message").textContent = e.message; });
