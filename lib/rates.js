// ============================================================
// RATE CALCULATION LOGIC
// ============================================================
// Reads live config from Edge Config (admin_config key).
// Falls back to hardcoded defaults if not set.
// ============================================================

const cache = require("./cache");

const EU_COUNTRIES = [
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
];

const DEFAULTS = {
  shipping: {
    UK: {
      flat: 400,
      label: "Standard Shipping",
      description: null,
    },
    EU: {
      light: 600,
      heavy: 850,
      threshold: 350,
      label: "Standard Shipping",
      description: null,
    },
    INTERNATIONAL: {
      light: 1200,
      heavy: 1500,
      threshold: 350,
      label: "Standard Shipping",
      description: null,
    },
  },
  surcharges: {
    UK: { amount: 0, label: "Standard Shipping (Oversized packaging required)", description: "Your order contains items that require a larger box." },
    EU: { amount: 0, label: "Standard Shipping (Oversized packaging required)", description: "Your order contains items that require a larger box." },
    INTERNATIONAL: { amount: 0, label: "Standard Shipping (Oversized packaging required)", description: "Your order contains items that require a larger box." },
  },
  packaging: { vinyl_mailer: 185, can_box: 185, cd_mailer: 50, tee_packet: 20 },
};

async function getAdminConfig() {
  try {
    const url = new URL(process.env.EDGE_CONFIG);
    const res = await fetch(`${url.origin}${url.pathname}/item/admin_config${url.search}`);
    if (!res.ok) return DEFAULTS;
    const config = await res.json();
    return config ? Object.assign({}, DEFAULTS, config) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
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

module.exports = { calculateRates };
