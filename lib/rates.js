// ============================================================
// RATE CALCULATION LOGIC
// ============================================================

const cache = require("./cache");
const surcharges = require("./surcharges");

const SURCHARGE_RATE_LABEL = "Standard Shipping (Oversized packaging required)";

async function calculateRates(shopifyRequest) {
  const { rate: rateRequest } = shopifyRequest;
  const { line_items, destination, shipping_address } = rateRequest;

  const destinationCountry =
    (destination && destination.country) ||
    (shipping_address && shipping_address.country) ||
    "DEFAULT";

  // Resolve box types for all line items concurrently
  const boxTypes = await Promise.all(
    line_items.map((item) =>
      cache.getBoxTypeForVariant(String(item.variant_id))
    )
  );

  const boxTypesInOrder = new Set(boxTypes);

  const needsSurcharge =
    boxTypesInOrder.has("vinyl_mailer") && boxTypesInOrder.has("can_box");

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
