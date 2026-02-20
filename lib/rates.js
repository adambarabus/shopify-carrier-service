// ============================================================
// RATE CALCULATION LOGIC
// ============================================================
// When vinyl_mailer + can_box are in the same order:
//   → Return a single oversized packaging rate only
// Otherwise:
//   → Return normal shipping rates based on destination + weight
// ============================================================

const cache = require("./cache");
const surcharges = require("./surcharges");

const SURCHARGE_RATE_LABEL = "Standard Shipping (Oversized packaging required)";

const EU_COUNTRIES = [
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
];

function getZone(countryCode) {
  if (countryCode === "GB") return "UK";
  if (EU_COUNTRIES.includes(countryCode)) return "EU";
  return "INTERNATIONAL";
}

function getNormalRates(zone, totalGrams) {
  if (zone === "UK") {
    return [{
      service_name: "Standard Shipping",
      service_code: "UK_STANDARD",
      total_price: "400",
      currency: "GBP",
      min_delivery_date: null,
      max_delivery_date: null,
      description: null,
    }];
  }

  if (zone === "EU") {
    const price = totalGrams <= 350 ? "600" : "850";
    return [{
      service_name: "Standard Shipping",
      service_code: "EU_STANDARD",
      total_price: price,
      currency: "GBP",
      min_delivery_date: null,
      max_delivery_date: null,
      description: null,
    }];
  }

  // INTERNATIONAL
  const price = totalGrams <= 350 ? "1200" : "1500";
  return [{
    service_name: "Standard Shipping",
    service_code: "INTL_STANDARD",
    total_price: price,
    currency: "GBP",
    min_delivery_date: null,
    max_delivery_date: null,
    description: null,
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

  const totalGrams = line_items.reduce(
    (sum, item) => sum + (item.grams || 0) * (item.quantity || 1), 0
  );

  const boxTypes = await Promise.all(
    line_items.map((item) =>
      cache.getBoxTypeForVariant(String(item.variant_id))
    )
  );

  const boxTypesInOrder = new Set(boxTypes);
  const needsSurcharge =
    boxTypesInOrder.has("vinyl_mailer") && boxTypesInOrder.has("can_box");

  if (needsSurcharge) {
    const surchargeConfig = surcharges[zone];
    return [{
      service_name: SURCHARGE_RATE_LABEL,
      service_code: "OVERSIZED",
      total_price: String(surchargeConfig.amount),
      currency: surchargeConfig.currency,
      min_delivery_date: null,
      max_delivery_date: null,
      description: "Your order contains items that require a larger box.",
    }];
  }

  return getNormalRates(zone, totalGrams);
}

module.exports = { calculateRates };
