const DEFAULTS = {
  enabled: false,
  scheme: "socks5",
  host: "",
  port: 1080,
  username: "",
  password: "",
  bypassList: ["localhost", "127.0.0.1"],
  location: { enabled: false, lat: 0, lng: 0, tzId: "UTC" },
};

const SCHEMES = ["http", "https", "socks4", "socks5"];

async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  return { ...DEFAULTS, ...(config || {}) };
}

// Credentials are intentionally optional. Chrome's proxy stack only supports
// username/password authentication for HTTP(S) proxies (via onAuthRequired);
// it cannot authenticate SOCKS4/SOCKS5. SOCKS endpoints should instead be
// bound to a private address (e.g. a Tailscale IP) so no credentials are needed.
function validate(c) {
  const port = Number(c.port);
  return (
    c.enabled === true &&
    SCHEMES.includes(c.scheme) &&
    typeof c.host === "string" &&
    c.host.trim().length > 0 &&
    Number.isInteger(port) &&
    port > 0 &&
    port < 65536
  );
}

async function applyProxy() {
  const c = await getConfig();
  if (!validate(c)) {
    await chrome.proxy.settings.clear({ scope: "regular" });
    return { enabled: false, error: c.enabled ? "Invalid proxy configuration" : null };
  }
  const bypass = Array.isArray(c.bypassList) ? c.bypassList.filter(Boolean) : [];
  await chrome.proxy.settings.set(
    {
      value: {
        mode: "fixed_servers",
        rules: {
          singleProxy: { scheme: c.scheme, host: c.host.trim(), port: Number(c.port) },
          bypassList: bypass,
        },
      },
      scope: "regular",
    }
  );
  return { enabled: true };
}

async function isApplied() {
  const { value } = await chrome.proxy.settings.get({});
  return value.mode === "fixed_servers";
}

// Best-effort WebRTC hardening: with the proxy and location protection both
// on, ask the browser not to send non-proxied UDP (WebRTC can otherwise leak
// the real IP around a proxy). Not every browser/version honors this, so
// failures are ignored silently.
async function syncWebRTC(c) {
  try {
    const value =
      c.enabled && c.location && c.location.enabled
        ? "disable_non_proxied_udp"
        : "default";
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value });
  } catch {
    // Unsupported here; page-world WebRTC still spoofs nothing, but the
    // Geolocation/timezone/Intl overrides remain active.
  }
}

// Supplies credentials only for HTTP(S) proxies that answer with 407.
chrome.webRequest.onAuthRequired.addListener(
  async details => {
    if (!details.isProxy) return {};
    const c = await getConfig();
    if (!c.username || !c.password) return {};
    return { authCredentials: { username: c.username, password: c.password } };
  },
  { urls: ["<all_urls>"] },
  ["asyncBlocking"]
);

chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.local.get("config");
  if (!config) await chrome.storage.local.set({ config: DEFAULTS });
  await chrome.alarms.create("keepalive", { periodInMinutes: 1 });
  await applyProxy();
});

// Auto-reconnect: the last endpoint stays in storage, so whenever the browser
// starts (or Chrome ever drops the proxy settings) an enabled config is
// re-applied without any user action.
chrome.runtime.onStartup.addListener(applyProxy);
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== "keepalive") return;
  const c = await getConfig();
  if (c.enabled && !(await isApplied())) await applyProxy();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "getConfig": {
        const config = await getConfig();
        return { ...config, password: undefined, applied: await isApplied() };
      }
      case "setConfig": {
        const next = { ...DEFAULTS, ...message.config, enabled: Boolean(message.config?.enabled) };
        await chrome.storage.local.set({ config: next });
        await syncWebRTC(next);
        return await applyProxy();
      }
      case "disconnect": {
        const next = { ...(await getConfig()), enabled: false };
        await chrome.storage.local.set({ config: next });
        await chrome.proxy.settings.clear({ scope: "regular" });
        await syncWebRTC(next);
        return { enabled: false, applied: false };
      }
      default:
        return { error: "Unknown message" };
    }
  })()
    .then(sendResponse)
    .catch(error => sendResponse({ error: String(error?.message || error) }));
  return true;
});