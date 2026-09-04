// Endpoint presets. Public proxies are convenience presets only; verify and
// trust an endpoint before sending sensitive traffic through it.
// Public entries are health-checked by Ghost before they are considered protected.
const GEONODE_PROXY_LIST_URL = "https://proxylist.geonode.com/api/proxy-list?page=1&limit=500&sort_by=responseTime&sort_type=asc";
const PROXY_PRESETS = [
  { id: "nuremberg", city: "Nürnberg", country: "Germany", scheme: "socks5", host: "157.90.113.23", port: 9052, source: "public", requiresVerification: true },
  { id: "warsaw", city: "Warsaw", country: "Poland", scheme: "socks5", host: "57.128.249.250", port: 9052, source: "public", requiresVerification: true },
  { id: "oregon", city: "Oregon", country: "USA", scheme: "socks5", host: "5.78.181.0", port: 9052, source: "public", requiresVerification: true },
];

const LOCATION_PRESETS = [
  { city: "Nürnberg", country: "Germany", tzId: "Europe/Berlin", lat: 49.45, lng: 11.08 },
  { city: "Warsaw", country: "Poland", tzId: "Europe/Warsaw", lat: 52.23, lng: 21.01 },
  { city: "Oregon", country: "United States", tzId: "America/Los_Angeles", lat: 44.0, lng: -120.5 },
  { city: "New York", country: "United States", tzId: "America/New_York", lat: 40.71, lng: -74.01 },
  { city: "Los Angeles", country: "United States", tzId: "America/Los_Angeles", lat: 34.05, lng: -118.24 },
  { city: "Chicago", country: "United States", tzId: "America/Chicago", lat: 41.88, lng: -87.63 },
  { city: "Denver", country: "United States", tzId: "America/Denver", lat: 39.74, lng: -104.99 },
  { city: "Vancouver", country: "Canada", tzId: "America/Vancouver", lat: 49.28, lng: -123.12 },
  { city: "Mexico City", country: "Mexico", tzId: "America/Mexico_City", lat: 19.43, lng: -99.13 },
  { city: "Sao Paulo", country: "Brazil", tzId: "America/Sao_Paulo", lat: -23.55, lng: -46.63 },
  { city: "London", country: "United Kingdom", tzId: "Europe/London", lat: 51.51, lng: -0.13 },
  { city: "Paris", country: "France", tzId: "Europe/Paris", lat: 48.86, lng: 2.35 },
  { city: "Berlin", country: "Germany", tzId: "Europe/Berlin", lat: 52.52, lng: 13.41 },
  { city: "Madrid", country: "Spain", tzId: "Europe/Madrid", lat: 40.42, lng: -3.7 },
  { city: "Rome", country: "Italy", tzId: "Europe/Rome", lat: 41.9, lng: 12.5 },
  { city: "Amsterdam", country: "Netherlands", tzId: "Europe/Amsterdam", lat: 52.37, lng: 4.9 },
  { city: "Stockholm", country: "Sweden", tzId: "Europe/Stockholm", lat: 59.33, lng: 18.07 },
  { city: "Athens", country: "Greece", tzId: "Europe/Athens", lat: 37.98, lng: 23.73 },
  { city: "Moscow", country: "Russia", tzId: "Europe/Moscow", lat: 55.76, lng: 37.62 },
  { city: "Istanbul", country: "Turkey", tzId: "Europe/Istanbul", lat: 41.01, lng: 28.98 },
  { city: "Johannesburg", country: "South Africa", tzId: "Africa/Johannesburg", lat: -26.2, lng: 28.05 },
  { city: "Nairobi", country: "Kenya", tzId: "Africa/Nairobi", lat: -1.29, lng: 36.82 },
  { city: "Dubai", country: "United Arab Emirates", tzId: "Asia/Dubai", lat: 25.2, lng: 55.27 },
  { city: "Mumbai", country: "India", tzId: "Asia/Kolkata", lat: 19.08, lng: 72.88 },
  { city: "Bangkok", country: "Thailand", tzId: "Asia/Bangkok", lat: 13.76, lng: 100.5 },
  { city: "Singapore", country: "Singapore", tzId: "Asia/Singapore", lat: 1.35, lng: 103.82 },
  { city: "Beijing", country: "China", tzId: "Asia/Shanghai", lat: 39.9, lng: 116.41 },
  { city: "Seoul", country: "South Korea", tzId: "Asia/Seoul", lat: 37.57, lng: 126.98 },
  { city: "Tokyo", country: "Japan", tzId: "Asia/Tokyo", lat: 35.68, lng: 139.65 },
  { city: "Sydney", country: "Australia", tzId: "Australia/Sydney", lat: -33.87, lng: 151.21 },
  { city: "Auckland", country: "New Zealand", tzId: "Pacific/Auckland", lat: -36.85, lng: 174.76 },
];

function findPreset(tzId) { return LOCATION_PRESETS.find(p => p.tzId === tzId); }
function findProxyPreset(id) { return PROXY_PRESETS.find(p => p.id === id); }