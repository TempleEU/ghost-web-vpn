const $ = id => document.getElementById(id);
const TEST_URLS = ["https://www.gstatic.com/generate_204", "https://example.com"];
const EMPTY_LOCATION = { enabled: false, lat: 0, lng: 0, tzId: "UTC" };

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

function setLocMessage(text, kind) {
  const el = $("locMsg");
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

function currentLocation(c) {
  return { ...EMPTY_LOCATION, ...(c && c.location) };
}

function buildRegionOptions() {
  const select = $("locRegion");
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a region\u2026";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);
  for (const p of LOCATION_PRESETS) {
    const opt = document.createElement("option");
    opt.value = p.tzId;
    opt.textContent = p.city + " \u2014 " + p.country + " (" + p.tzId + ")";
    select.appendChild(opt);
  }
}

function renderLocation(c) {
  const loc = currentLocation(c);
  $("locOn").checked = loc.enabled;
  $("locBody").hidden = !loc.enabled;
  $("locDetect").disabled = !c.enabled;
  const select = $("locRegion");
  const p = findPreset(loc.tzId);
  if (p) {
    select.value = p.tzId;
  } else {
    // Show the current (possibly custom/detected) zone as a selectable option.
    if (!select.querySelector('option[value="' + loc.tzId + '"]')) {
      const opt = document.createElement("option");
      opt.value = loc.tzId;
      opt.textContent = "Current: " + loc.tzId;
      select.appendChild(opt);
    }
    select.value = loc.tzId;
  }
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
  renderLocation(c);
}

// Saves the current form plus a (partial) location update without ever
// dropping the other config fields or the enabled flag.
async function persistLocation(patch) {
  const current = await send("getConfig");
  const location = { ...currentLocation(current), ...patch };
  return send("setConfig", { ...readForm(), location, enabled: current.enabled });
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

async function connect(current) {
  const config = { ...readForm(), enabled: true, location: currentLocation(current) };
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

async function detectFromConnection() {
  const current = await send("getConfig");
  if (!current.enabled) {
    setLocMessage("Connect to your endpoint first, then detect.", "error");
    return;
  }
  setLocMessage("Detecting endpoint region\u2026");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data || !data.timezone) throw new Error("No timezone in response");
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    const location = { enabled: true, lat: Number.isFinite(lat) ? lat : 0, lng: Number.isFinite(lng) ? lng : 0, tzId: data.timezone };
    const result = await persistLocation(location);
    if (result?.error) throw new Error(result.error);
    setLocMessage("Location synced to " + data.timezone + ". Refresh tabs to apply.", "ok");
  } catch (e) {
    setLocMessage("Detection failed: " + (e && e.message ? e.message : e) + ". Pick a region manually.", "error");
  } finally {
    clearTimeout(timer);
  }
  await load();
}

$("toggle").addEventListener("click", async () => {
  const current = await send("getConfig");
  if (current.enabled) await disconnect();
  else await connect(current);
  await load();
});

$("locOn").addEventListener("change", async () => {
  $("locBody").hidden = !$("locOn").checked;
  const loc = await send("getConfig").then(c => currentLocation(c));
  if ($("locOn").checked && loc.tzId === "UTC" && loc.lat === 0 && loc.lng === 0) {
    // Nothing usable selected yet — ask for a region instead of spoofing 0,0.
    $("locOn").checked = false;
    $("locBody").hidden = true;
    setLocMessage("Pick an endpoint region below, or use Detect.", "error");
    return;
  }
  const result = await persistLocation({ enabled: $("locOn").checked });
  setLocMessage(result?.error || ($("locOn").checked ? "Location protection on. Refresh tabs to apply." : "Location protection off."), result?.error ? "error" : "ok");
  renderLocation(await send("getConfig"));
});

$("locRegion").addEventListener("change", async () => {
  const p = findPreset($("locRegion").value);
  if (!p) return;
  const loc = await send("getConfig").then(c => currentLocation(c));
  await persistLocation({ enabled: loc.enabled, lat: p.lat, lng: p.lng, tzId: p.tzId });
  setLocMessage("Region set to " + p.city + " (" + p.tzId + "). Refresh tabs to apply.", "ok");
});

$("locDetect").addEventListener("click", detectFromConnection);

["scheme", "host", "port", "username", "password"].forEach(id =>
  $(id).addEventListener("change", async () => {
    const current = await send("getConfig");
    if (current.enabled) {
      await send("setConfig", { ...readForm(), enabled: true, location: currentLocation(current) });
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

buildRegionOptions();
load().catch(e => setMessage(e.message, "error"));