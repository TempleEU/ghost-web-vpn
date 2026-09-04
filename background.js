const DEFAULTS = { enabled: false, scheme: "http", host: "127.0.0.1", port: 8080, bypassList: ["localhost", "127.0.0.1"] };

async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  return { ...DEFAULTS, ...(config || {}) };
}

function validate(c) {
  const port = Number(c.port);
  return c.enabled === true && ["http", "https", "socks4", "socks5"].includes(c.scheme) &&
    typeof c.host === "string" && c.host.trim().length > 0 && Number.isInteger(port) && port > 0 && port < 65536;
}

async function applyProxy() {
  const c = await getConfig();
  if (!validate(c)) {
    await chrome.proxy.settings.clear({ scope: "regular" });
    return { enabled: false, error: c.enabled ? "Invalid proxy configuration" : null };
  }
  const bypass = Array.isArray(c.bypassList) ? c.bypassList.filter(Boolean) : [];
  await chrome.proxy.settings.set({
    value: { mode: "fixed_servers", rules: { singleProxy: { scheme: c.scheme, host: c.host.trim(), port: Number(c.port) }, bypassList: bypass } },
    scope: "regular"
  });
  return { enabled: true };
}

chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.local.get("config");
  if (!config) await chrome.storage.local.set({ config: DEFAULTS });
  await applyProxy();
});

chrome.runtime.onStartup.addListener(applyProxy);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "getConfig") return { ...(await getConfig()) };
    if (message?.type === "setConfig") {
      const next = { ...DEFAULTS, ...message.config, enabled: Boolean(message.config?.enabled) };
      await chrome.storage.local.set({ config: next });
      return await applyProxy();
    }
    if (message?.type === "disconnect") {
      await chrome.storage.local.set({ config: { ...(await getConfig()), enabled: false } });
      await chrome.proxy.settings.clear({ scope: "regular" });
      return { enabled: false };
    }
    return { error: "Unknown message" };
  })().then(sendResponse).catch(error => sendResponse({ error: String(error?.message || error) }));
  return true;
});
