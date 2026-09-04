// Ghost Web VPN — location protection content script.
//
// A proxy/VPN changes your IP, but the browser still leaks your real location
// through the Geolocation API, Date/timezone getters, and Intl. This script
// runs at document_start in every frame and makes those surfaces report the
// location chosen in the popup instead. It is original code implementing the
// same class of protection as GeoSpoof (MIT), which inspired the feature.
//
// All behavior is driven by config.location in chrome.storage.local:
// { enabled: boolean, lat: number, lng: number, tzId: string (IANA) }.
// Config changes are applied live via chrome.storage.onChanged.

(() => {
  if (window.__ghostSpoof) return;
  window.__ghostSpoof = true;

  const FALLBACK = { enabled: false, lat: 0, lng: 0, tzId: "UTC" };
  let loc = FALLBACK;

  // ---- timezone helpers (operate on the *original* Date) ----------------
  // Uses the pre-patch snapshot declared below (orig.getTimezoneOffset); the
  // arrow only runs at call time, after `orig` is initialized.
  const realOffsetMin = t => -orig.getTimezoneOffset.call(new Date(t));
  const offCache = new Map(); // tzId -> { bucket, east, name }

  function tzInfo(t, tzId) {
    const bucket = Math.floor(t / 43200000); // 12 h buckets keep DST transitions fresh
    const hit = offCache.get(tzId);
    if (hit && hit.bucket === bucket) return hit;
    if (tzId === "__real__") {
      const real = { bucket, east: realOffsetMin(t), name: "" };
      offCache.set(tzId, real);
      return real;
    }
    let east = 0;
    let name = "";
    try {
      const off = new Intl.DateTimeFormat("en-US", { timeZone: tzId, timeZoneName: "longOffset" }).formatToParts(t).find(p => p.type === "timeZoneName");
      const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec((off && off.value) || "");
      if (m) east = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
      const nm = new Intl.DateTimeFormat("en-US", { timeZone: tzId, timeZoneName: "long" }).formatToParts(t).find(p => p.type === "timeZoneName");
      name = (nm && nm.value) || "";
    } catch {
      // Unknown time zone id: fall back to real local time.
      east = realOffsetMin(t);
      name = "";
    }
    const info = { bucket, east, name };
    offCache.set(tzId, info);
    return info;
  }

  // ---- snapshot original implementations ---------------------------------
  const orig = {
    geolocation: navigator.geolocation && {
      getCurrentPosition: navigator.geolocation.getCurrentPosition.bind(navigator.geolocation),
      watchPosition: navigator.geolocation.watchPosition.bind(navigator.geolocation),
      clearWatch: navigator.geolocation.clearWatch.bind(navigator.geolocation),
    },
    permissionsQuery: navigator.permissions && navigator.permissions.query.bind(navigator.permissions),
    getTimezoneOffset: Date.prototype.getTimezoneOffset,
    getFullYear: Date.prototype.getFullYear,
    getMonth: Date.prototype.getMonth,
    getDate: Date.prototype.getDate,
    getDay: Date.prototype.getDay,
    getHours: Date.prototype.getHours,
    getMinutes: Date.prototype.getMinutes,
    getSeconds: Date.prototype.getSeconds,
    getMilliseconds: Date.prototype.getMilliseconds,
    toString: Date.prototype.toString,
    DateTimeFormat: Intl.DateTimeFormat,
  };

  let patched = false;

  function patch() {
    if (patched) return;
    patched = true;

    // --- Date: shift every local getter by (spoof offset - real offset) ---
    const shiftMs = t => (tzInfo(t, loc.tzId).east - realOffsetMin(t)) * 60000;
    const shifted = t => new Date(t + shiftMs(t));

    const shiftGetters = {
      getFullYear: orig.getFullYear,
      getMonth: orig.getMonth,
      getDate: orig.getDate,
      getDay: orig.getDay,
      getHours: orig.getHours,
      getMinutes: orig.getMinutes,
      getSeconds: orig.getSeconds,
      getMilliseconds: orig.getMilliseconds,
    };
    for (const name in shiftGetters) {
      const fn = shiftGetters[name];
      Object.defineProperty(Date.prototype, name, {
        configurable: true,
        writable: true,
        value: function () {
          return fn.call(shifted(this.getTime()));
        },
      });
    }
    Object.defineProperty(Date.prototype, "getTimezoneOffset", {
      configurable: true,
      writable: true,
      value: function () {
        return -tzInfo(this.getTime(), loc.tzId).east;
      },
    });
    Object.defineProperty(Date.prototype, "toString", {
      configurable: true,
      writable: true,
      value: function () {
        const info = tzInfo(this.getTime(), loc.tzId);
        const s = orig.toString.call(shifted(this.getTime()));
        return info.name ? s.replace(/\([^)]*\)\s*$/, "(" + info.name + ")") : s;
      },
    });

    // --- Intl.DateTimeFormat: force the spoofed zone ----------------------
    function SpoofedDTF(locales, options) {
      const opts = Object.assign({}, options);
      if (!("timeZone" in opts)) opts.timeZone = loc.tzId;
      return new orig.DateTimeFormat(locales, opts);
    }
    SpoofedDTF.prototype = orig.DateTimeFormat.prototype;
    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      writable: true,
      value: SpoofedDTF,
    });

    // --- Geolocation -------------------------------------------------------
    if (orig.geolocation) {
      const fakePosition = () => ({
        coords: {
          latitude: loc.lat,
          longitude: loc.lng,
          accuracy: 50,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
      navigator.geolocation.getCurrentPosition = (success, _error, _options) => {
        setTimeout(() => success(fakePosition()), 0);
      };
      navigator.geolocation.watchPosition = success => {
        setTimeout(() => success(fakePosition()), 0);
        return 1;
      };
      navigator.geolocation.clearWatch = orig.geolocation.clearWatch;
    }

    // --- Permissions: geolocation always "granted" --------------------------
    if (orig.permissionsQuery) {
      navigator.permissions.query = descriptor =>
        orig.permissionsQuery(descriptor).then(status => {
          if (descriptor && descriptor.name === "geolocation") {
            try {
              Object.defineProperty(status, "state", { configurable: true, get: () => "granted" });
            } catch {
              /* ignore */
            }
          }
          return status;
        });
    }
  }

  function apply(next) {
    const on = Boolean(next && next.enabled);
    // When off, report the real local zone ("__real__") rather than UTC.
    loc = on ? { ...FALLBACK, ...next } : { ...FALLBACK, tzId: "__real__" };
    if (on) patch();
  }

  chrome.storage.local.get("config", ({ config }) => apply(config && config.location));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.config) {
      const cfg = changes.config.newValue;
      apply(cfg && cfg.location);
    }
  });
})();