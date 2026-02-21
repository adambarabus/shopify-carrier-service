// ============================================================
// RATE CALCULATION LOGIC
// ============================================================
// Reads live config from Edge Config (admin_config key).
// Config is cached in memory for 24 hours as a safety net.
// Cache is busted immediately when admin saves via POST /admin/bust-cache.
// Falls back to hardcoded defaults if not set.
// ============================================================

const cache = require("./cache");

const EU_COUNTRIES = [
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
];

const DEFAULTS = {
  shipping: {
    UK: { flat: 400, label: "Royal Mail Tracked 48", description: "Tracking number provided" },
    EU: { light: 600, heavy: 850, threshold: 350, label: "International Tracked Courier", description: "Tracking number provided. All import duties included." },
    INTERNATIONAL: { light: 1200, heavy: 1500, threshold: 350, label: "International Tracked Courier", description: "Tracking number provided. All import duties and taxes included. (Sorry, these are expensive to pay from the UK)" },
  },
  surcharges: {
    UK: { amount: 600, label: "Royal Mail Tracked 48 - Oversized packaging required (Vinyl + Can)", description: "Your order contains items that require a larger box." },
    EU: { amount: 1000, label: "International Tracked Courier - Oversized packaging required (Vinyl + Can)", description: "Your order contains items that require a larger box. Tracking number provided. All import duties included." },
    INTERNATIONAL: { amount: 2200, label: "International Tracked Courier - Oversized packaging required (Vinyl + Can)", description: "International Tracked Courier - Oversized packaging required (Vinyl + Can)", description: "Your order contains items that require a larger box. Tracking number provided. All import duties and taxes included. (Sorry, these are expensive to pay from the UK)" },
  },
  packaging: { vinyl_mailer: 185, can_box: 185, cd_mailer: 50, tee_packet: 20 },
};

// In-memory config cache — 24 hour TTL, busted on admin save
let configCache = null;
let configCacheExpiry = 0;
const CONFIG_TTL_MS = 24 * 60 * 60 * 1000;

async function getAdminConfig() {
  if (configCache && Date.now() < configCacheExpiry) {
    return configCache;
  }
  try {
    const url = new URL(process.env.EDGE_CONFIG);
    const res = await fetch(`${url.origin}${url.pathname}/item/admin_config${url.search}`);
    if (!res.ok) return DEFAULTS;
    const config = await res.json();
    configCache = config ? deepMerge(DEFAULTS, config) : DEFAULTS;
    configCacheExpiry = Date.now() + CONFIG_TTL_MS;
    return configCache;
  } catch {
    return configCache || DEFAULTS;
  }
}

function bustConfigCache() {
  configCache = null;
  configCacheExpiry = 0;
}

function deepMerge(defaults, overrides) {
  const result = Object.assign({}, defaults);
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === "object" && !Array.isArray(overrides[key])) {
      result[key] = deepMerge(defaults[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

function getZone(countryCode) {
  if (countryCode === "GB") return "UK";
  if (EU_COUNTRIES.includes(countryCode)) return "EU";
  return "INTERNATIONAL";
}

function getNormalRates(zone, totalGrams, cfg) {
  const s = cfg.shipping[zone];
  let price;
  if (zone === "UK") {
    price = s.flat;
  } else {
    price = totalGrams <= s.threshold ? s.light : s.heavy;
  }
  return [{
    service_name: s.label || "Standard Shipping",
    service_code: `${zone}_STANDARD`,
    total_price: String(price),
    currency: "GBP",
    min_delivery_date: null,
    max_delivery_date: null,
    description: s.description || null,
  }];
}

async function calculateRates(shopifyRequest) {
  const rateRequest = shopifyRequest.rate || shopifyRequest;

  const line_items =
    rateRequest.items ||
    rateRequest.line_items ||
    shopifyRequest.items ||
    shopifyRequest.line_items ||
    [];

  const destination =
    rateRequest.destination ||
    rateRequest.shipping_address ||
    shopifyRequest.destination ||
    shopifyRequest.shipping_address ||
    {};

  const destinationCountry = destination.country || "";
  const zone = getZone(destinationCountry);

  if (!line_items.length) return [];

  const [cfg, boxTypes] = await Promise.all([
    getAdminConfig(),
    Promise.all(line_items.map((item) => cache.getBoxTypeForVariant(String(item.variant_id)))),
  ]);

  const productGrams = line_items.reduce((sum, item) => {
    return sum + (item.grams || 0) * (item.quantity || 1);
  }, 0);

  const uniqueBoxTypes = new Set(boxTypes);
  const heaviestPackaging = Math.max(
    ...[...uniqueBoxTypes].map((bt) => cfg.packaging[bt] || 0)
  );

  const totalGrams = productGrams + heaviestPackaging;

  const needsSurcharge =
    uniqueBoxTypes.has("vinyl_mailer") && uniqueBoxTypes.has("can_box");

  if (needsSurcharge) {
    const sc = cfg.surcharges[zone];
    return [{
      service_name: sc.label || "Standard Shipping (Oversized packaging required)",
      service_code: "OVERSIZED",
      total_price: String(sc.amount),
      currency: "GBP",
      min_delivery_date: null,
      max_delivery_date: null,
      description: sc.description || null,
    }];
  }

  return getNormalRates(zone, totalGrams, cfg);
}

module.exports = { calculateRates, bustConfigCache };
