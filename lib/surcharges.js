// ============================================================
// SURCHARGE CONFIGURATION
// ============================================================
// Set the surcharge amount for each country code below.
// Amounts are in the minor unit of the currency (e.g. pence,
// cents) as integers — Shopify rates use minor units.
//
// Examples:
//   500  =  £5.00 GBP
//   750  =  $7.50 USD
//   600  =  €6.00 EUR
//
// Add or remove country codes as needed.
// "DEFAULT" is used as a fallback for any country not listed.
// Set a country to 0 if you do not want a surcharge there.
// ============================================================

const surcharges = {

  // -- British Isles --
  GB: { amount: 0, currency: "GBP" }, // 0 = TO BE DEFINED

  // -- North America --
  US: { amount: 0, currency: "USD" }, // 0 = TO BE DEFINED
  CA: { amount: 0, currency: "CAD" }, // 0 = TO BE DEFINED
  MX: { amount: 0, currency: "MXN" }, // 0 = TO BE DEFINED

  // -- Europe (Euro) --
  DE: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  FR: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  IE: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  IT: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  ES: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  NL: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  BE: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  AT: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  PT: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED
  FI: { amount: 0, currency: "EUR" }, // 0 = TO BE DEFINED

  // -- Europe (Non-Euro) --
  CH: { amount: 0, currency: "CHF" }, // 0 = TO BE DEFINED (Switzerland)
  CZ: { amount: 0, currency: "CZK" }, // 0 = TO BE DEFINED (Czech Republic)
  DK: { amount: 0, currency: "DKK" }, // 0 = TO BE DEFINED (Denmark)
  HU: { amount: 0, currency: "HUF" }, // 0 = TO BE DEFINED (Hungary)
  IS: { amount: 0, currency: "ISK" }, // 0 = TO BE DEFINED (Iceland)
  NO: { amount: 0, currency: "NOK" }, // 0 = TO BE DEFINED (Norway)
  PL: { amount: 0, currency: "PLN" }, // 0 = TO BE DEFINED (Poland)
  SE: { amount: 0, currency: "SEK" }, // 0 = TO BE DEFINED (Sweden)

  // -- Oceania --
  AU: { amount: 0, currency: "AUD" }, // 0 = TO BE DEFINED

  // -- Fallback for all other countries --
  DEFAULT: { amount: 0, currency: "GBP" }, // 0 = TO BE DEFINED
};

module.exports = surcharges;
