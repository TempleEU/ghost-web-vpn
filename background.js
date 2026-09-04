const DEFAULT_LOCATION = { enabled: false, lat: 0, lng: 0, tzId: "UTC" };
const DEFAULTS = {
  enabled: false,
  scheme: "socks5",
  host: "",
  port: 1080,
  username: "",
  password: "",
  bypassList: ["localhost", "127.0.0.1"],
  location: DEFAULT_LOCATION,
  siteRules: { route: [], bypass: [], block: [] },
  profiles: [],
  activeProfileId: "",
  killSwitch: true,
  protectionDropped: false,
  proof: null,
  language: "en",
};
const SCHEMES = ["http", "https", "socks4", "socks5"];
const PROBE_URL = "https://www.gstatic.com/generate_204";
const IP_URL = "https://ipapi.co/json/";
const BLOCK_PORT = 9;

async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  return {
    ...DEFAULTS,
    ...(config || {}),
    location: { ...DEFAULT_LOCATION, ...((config && config.location) || {}) },
    siteRules: { route: [], bypass: [], block: [], ...((config && config.siteRules) || {}) },
    profiles: Array.isArray(config?.profiles) ? config.profiles : [],
  };
}

function validate(c) {
  const port = Number(c.port);
  return c.enabled === true && SCHEMES.includes(c.scheme) && typeof c.host === "string" && c.host.trim() && Number.isInteger(port) && port > 0 && port < 65536;
}

function normalizeHost(host) {
  return String(host || "").trim().toLowerCase().replace(/^\*:\/\//, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\./, "");
}
function cleanRules(rules) {
  const out = { route: [], bypass: [], block: [] };
  for (const type of Object.keys(out)) out[type] = [...new Set((Array.isArray(rules?.[type]) ? rules[type] : []).map(normalizeHost).filter(Boolean))];
  return out;
}
function hostMatches(host, rule) { return host === rule || host.endsWith("." + rule); }

function pacData(c) {
  const endpoint = JSON.stringify(`${c.scheme}://${c.host.trim()}:${Number(c.port)}`);
  const rules = JSON.stringify(cleanRules(c.siteRules));
  return `function FindProxyForURL(url, host) {\nconst endpoint=${endpoint}; const rules=${rules}; host=(host||\"\").toLowerCase();\nconst match=list=>list.some(r=>host===r||host.endsWith(\".\"+r));\nif(match(rules.block)) return \"PROXY 0.0.0.0:${BLOCK_PORT}\";\nif(match(rules.bypass)) return \"DIRECT\";\nif(match(rules.route)) return endpoint.startsWith(\"socks5://\")?\"SOCKS5 ${c.host.trim()}:${Number(c.port)}\":endpoint.startsWith(\"socks4://\")?\"SOCKS ${c.host.trim()}:${Number(c.port)}\":endpoint.startsWith(\"https://\")?\"HTTPS ${c.host.trim()}:${Number(c.port)}\":\"PROXY ${c.host.trim()}:${Number(c.port)}\";\nreturn endpoint.startsWith(\"socks5://\")?\"SOCKS5 ${c.host.trim()}:${Number(c.port)}\":endpoint.startsWith(\"socks4://\")?\"SOCKS ${c.host.trim()}:${Number(c.port)}\":endpoint.startsWith(\"https://\")?\"HTTPS ${c.host.trim()}:${Number(c.port)}\":\"PROXY ${c.host.trim()}:${Number(c.port)}\";\n}`;
}

async function applyProxy() {
  const c = await getConfig();
  if (!validate(c)) {
    if (c.killSwitch && c.enabled) await chrome.proxy.settings.set({ value: { mode: "fixed_servers", rules: { singleProxy: { scheme: "http", host: "0.0.0.0", port: BLOCK_PORT } } }, scope: "regular" });
    else await chrome.proxy.settings.clear({ scope: "regular" });
    return { enabled: false, error: c.enabled ? "Invalid proxy configuration" : null };
  }
  await chrome.proxy.settings.set({ value: { mode: "pac_script", pacScript: { data: pacData(c) } }, scope: "regular" });
  return { enabled: true };
}

async function blockTraffic() {
  await chrome.proxy.settings.set({ value: { mode: "fixed_servers", rules: { singleProxy: { scheme: "http", host: "0.0.0.0", port: BLOCK_PORT } } }, scope: "regular" });
}
async function isApplied() {
  const { value } = await chrome.proxy.settings.get({});
  return value.mode === "pac_script";
}

async function syncWebRTC(c) {
  try {
    const value = c.enabled && c.location?.enabled && !c.protectionDropped ? "disable_non_proxied_udp" : "default";
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value });
  } catch {}
}

async function fetchJsonThroughProxy(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function syncEndpointIdentity() {
  const c = await getConfig();
  if (!c.enabled || c.protectionDropped) return { ok: false };
  try {
    const data = await fetchJsonThroughProxy(IP_URL);
    if (!data?.timezone) throw new Error("No timezone in response");
    const next = await getConfig();
    next.location = { enabled: true, lat: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : 0, lng: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : 0, tzId: data.timezone };
    next.proof = { ip: data.ip || "Unknown", city: data.city || "Unknown", country: data.country_name || data.country || "Unknown", timezone: data.timezone, syncedAt: Date.now() };
    await chrome.storage.local.set({ config: next });
    await syncWebRTC(next);
    return { ok: true, proof: next.proof };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}

async function probeEndpoint() {
  const c = await getConfig();
  if (!c.enabled || !validate(c)) return false;
  if (!(await isApplied())) await applyProxy();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(PROBE_URL, { cache: "no-store", signal: controller.signal });
    return res.ok;
  } catch { return false; } finally { clearTimeout(timer); }
}

async function handleProbeFailure() {
  const c = await getConfig();
  if (!c.enabled || !c.killSwitch) return;
  const next = { ...c, protectionDropped: true };
  await chrome.storage.local.set({ config: next });
  await syncWebRTC(next);
  await blockTraffic();
}

async function recoverIfPossible() {
  const c = await getConfig();
  if (!c.enabled || !c.protectionDropped) return;
  await applyProxy();
  if (await probeEndpoint()) {
    const next = await getConfig();
    next.protectionDropped = false;
    await chrome.storage.local.set({ config: next });
    await syncWebRTC(next);
    await syncEndpointIdentity();
  } else await blockTraffic();
}

chrome.webRequest.onAuthRequired.addListener(async details => {
  if (!details.isProxy) return {};
  const c = await getConfig();
  if (!c.username || !c.password) return {};
  return { authCredentials: { username: c.username, password: c.password } };
}, { urls: ["<all_urls>"] }, ["asyncBlocking"]);

chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.local.get("config");
  if (!config) await chrome.storage.local.set({ config: DEFAULTS });
  await chrome.alarms.create("keepalive", { periodInMinutes: 1 });
  await applyProxy();
});
chrome.runtime.onStartup.addListener(async () => { await applyProxy(); const c = await getConfig(); if (c.enabled) await syncEndpointIdentity(); });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== "keepalive") return;
  const c = await getConfig();
  if (!c.enabled) return;
  if (c.protectionDropped) { await recoverIfPossible(); return; }
  if (!(await probeEndpoint())) await handleProbeFailure();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "getConfig": { const config = await getConfig(); return { ...config, password: undefined, applied: await isApplied() }; }
      case "connectAndSync": {
        const next = { ...DEFAULTS, ...message.config, enabled: true, protectionDropped: false, siteRules: cleanRules(message.config?.siteRules) };
        await chrome.storage.local.set({ config: next });
        await applyProxy();
        await syncWebRTC(next);
        return await syncEndpointIdentity();
      }
      case "setConfig": {
        const next = { ...DEFAULTS, ...(await getConfig()), ...message.config, enabled: Boolean(message.config?.enabled), siteRules: cleanRules(message.config?.siteRules || (await getConfig()).siteRules) };
        await chrome.storage.local.set({ config: next });
        await syncWebRTC(next);
        return await applyProxy();
      }
      case "disconnect": {
        const next = { ...(await getConfig()), enabled: false, protectionDropped: false };
        await chrome.storage.local.set({ config: next });
        await chrome.proxy.settings.clear({ scope: "regular" });
        await syncWebRTC(next);
        return { enabled: false, applied: false };
      }
      case "setSiteRule": {
        const c = await getConfig(); const host = normalizeHost(message.host); if (!host) return { error: "Invalid host" };
        const rules = cleanRules(c.siteRules); for (const type of ["route", "bypass", "block"]) rules[type] = rules[type].filter(h => h !== host);
        if (["route", "bypass", "block"].includes(message.rule)) rules[message.rule].push(host);
        c.siteRules = rules; await chrome.storage.local.set({ config: c }); if (c.enabled) await applyProxy(); return { siteRules: rules };
      }
      case "saveProfile": {
        const c = await getConfig(); const p = { id: message.profile?.id || crypto.randomUUID(), name: String(message.profile?.name || "Endpoint"), scheme: message.profile.scheme, host: message.profile.host, port: Number(message.profile.port), username: message.profile.username || "", password: message.profile.password || "" };
        c.profiles = [...c.profiles.filter(x => x.id !== p.id), p]; await chrome.storage.local.set({ config: c }); return { profiles: c.profiles };
      }
      case "switchProfile": {
        const c = await getConfig(); const p = c.profiles.find(x => x.id === message.id); if (!p) return { error: "Profile not found" };
        const next = { ...c, ...p, enabled: true, activeProfileId: p.id, protectionDropped: false }; delete next.id; delete next.name; await chrome.storage.local.set({ config: next }); await applyProxy(); await syncWebRTC(next); const proof = await syncEndpointIdentity(); return { ...proof, profile: p };
      }
      case "deleteProfile": { const c = await getConfig(); c.profiles = c.profiles.filter(x => x.id !== message.id); await chrome.storage.local.set({ config: c }); return { profiles: c.profiles }; }
      case "syncIdentity": return await syncEndpointIdentity();
      default: return { error: "Unknown message" };
    }
  })().then(sendResponse).catch(error => sendResponse({ error: String(error?.message || error) }));
  return true;
});