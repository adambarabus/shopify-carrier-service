// ============================================================
// RATE CALCULATION LOGIC
// ============================================================
// Determines whether the surcharge should apply for a given
// set of cart line items, and builds the rate response.
// ============================================================

const cache = require("./cache");
const surcharges = require("./surcharges");

const TRIGGER_TYPES = ["vinyl_mailer", "can_box"];

// Rate name shown to the customer at checkout when the surcharge applies.
// Edit this string to change what the customer sees.
const SURCHARGE_RATE_LABEL = "Standard Shipping (Oversized packaging required)";

/**
 * Evaluates a Shopify carrier service request and returns
 * an array of rate objects to send back to Shopify.
 *
 * @param {object} shopifyRequest - The parsed body from Shopify's carrier callback
 * @returns {Array} rates - Array of rate objects
 */
function calculateRates(shopifyRequest) {
  const { rate: rateRequest } = shopifyRequest;
  const { line_items, destination, shipping_address } = rateRequest;

  const destinationCountry =
    (destination && destination.country) ||
    (shipping_address && shipping_address.country) ||
    "DEFAULT";

  // --- Step 1: Resolve box types for all line items ---
  const boxTypesInOrder = new Set();

  for (const item of line_items) {
    const variantId = String(item.variant_id);
    const boxType = cache.getBoxTypeForVariant(variantId);
    boxTypesInOrder.add(boxType);
  }

  // --- Step 2: Check trigger condition ---
  const needsSurcharge =
    boxTypesInOrder.has("vinyl_mailer") && boxTypesInOrder.has("can_box");

  // --- Step 3: Build rate(s) to return ---
  // We return a single rate. If the surcharge applies, the price and label
  // are adjusted. Shopify handles the weight-based baseline separately —
  // this service only needs to return the surcharge-aware rate.

  if (!needsSurcharge) {
    // No surcharge — return empty array so Shopify falls back to its
    // own configured rates (weight-based). This is the correct approach
    // when no override is needed.
    return [];
  }

  // --- Step 4: Look up surcharge for destination country ---
  const surchargeConfig =
    surcharges[destinationCountry] || surcharges["DEFAULT"];
  const surchargeAmount = surchargeConfig.amount;
  const surchargeCurrency = surchargeConfig.currency;

  // If surcharge is 0 (not yet configured), still flag it but charge nothing.
  // This allows testing the trigger logic before amounts are finalised.
  const rates = [
    {
      service_name: SURCHARGE_RATE_LABEL,
      service_code: "OVERSIZED",
      total_price: String(surchargeAmount), // in minor units (pence/cents)
      currency: surchargeCurrency,
      min_delivery_date: null,
      max_delivery_date: null,
      description: "Your order contains items that require a larger box.",
    },
  ];

  return rates;
}

module.exports = { calculateRates };
