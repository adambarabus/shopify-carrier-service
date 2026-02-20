// ============================================================
// RATE CALCULATION LOGIC
// ============================================================

const cache = require("./cache");
const surcharges = require("./surcharges");

const SURCHARGE_RATE_LABEL = "Standard Shipping (Oversized packaging required)";

async function calculateRates(shopifyRequest) {
  // Shopify wraps the payload in a "rate" key
  const rateRequest = shopifyRequest.rate || shopifyRequest;

  // line_items can be at different levels depending on Shopify's format
  const line_items =
    rateRequest.line_items ||
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

  // Resolve box types for all line items concurrently
  const boxTypes = await Promise.all(
    line_items.map((item) =>
      cache.getBoxTypeForVariant(String(item.variant_id))
    )
  );

  console.log(`Box types resolved: ${JSON.stringify(boxTypes)}`);

  const boxTypesInOrder = new Set(boxTypes);

  const needsSurcharge =
    boxTypesInOrder.has("vinyl_mailer") && boxTypesInOrder.has("can_box");

  console.log(`Surcharge needed: ${needsSurcharge}`);

  if (!needsSurcharge) {
    return [];
  }

  const surchargeConfig =
    surcharges[destinationCountry] || surcharges["DEFAULT"];
  const surchargeAmount = surchargeConfig.amount;
  const surchargeCurrency = surchargeConfig.currency;

  return [
    {
      service_name: SURCHARGE_RATE_LABEL,
      service_code: "OVERSIZED",
      total_price: String(surchargeAmount),
      currency: surchargeCurrency,
      min_delivery_date: null,
      max_delivery_date: null,
      description: "Your order contains items that require a larger box.",
    },
  ];
}

module.exports = { calculateRates };
