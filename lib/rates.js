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

// ---- Normal shipping rates ----

function getNormalRates(destinationCountry, totalGrams, currency) {
  // UK
  if (destinationCountry === "GB") {
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

  // EU countries
  const euCountries = [
    "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
    "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
  ];

  if (euCountries.includes(destinationCountry)) {
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

  // International (rest of world)
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

// ---- Main rate calculation ----

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

  const destinationCountry = destination.country || "DEFAULT";

  console.log(`Carrier called: ${line_items.length} line items, destination: ${destinationCountry}`);

  if (!line_items.length) {
    console.log("No line items found in payload");
    return [];
  }

  // Total weight in grams
  const totalGrams = line_items.reduce((sum, item) => sum + (item.grams || 0) * (item.quantity || 1), 0);

  // Resolve box types
  const boxTypes = await Promise.all(
    line_items.map((item) =>
      cache.getBoxTypeForVariant(String(item.variant_id))
    )
  );

  console.log(`Box types resolved: ${JSON.stringify(boxTypes)}, total grams: ${totalGrams}`);

  const boxTypesInOrder = new Set(boxTypes);
  const needsSurcharge =
    boxTypesInOrder.has("vinyl_mailer") && boxTypesInOrder.has("can_box");

  console.log(`Surcharge needed: ${needsSurcharge}`);

  if (needsSurcharge) {
    const surchargeConfig = surcharges[destinationCountry] || surcharges["DEFAULT"];
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

  return getNormalRates(destinationCountry, totalGrams, rateRequest.currency || "GBP");
}

module.exports = { calculateRates };
