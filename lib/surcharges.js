// ============================================================
// SURCHARGE CONFIGURATION BY ZONE
// ============================================================
// Amounts are in minor units (pence).
// Zones match the normal shipping rate zones in rates.js:
//   UK          → GB only
//   EU          → EU member states
//   INTERNATIONAL → rest of world
// ============================================================

module.exports = {
  UK:            { amount: 400, currency: "GBP" },
  EU:            { amount: 800, currency: "GBP" },
  INTERNATIONAL: { amount: 1500, currency: "GBP" },
};
