// ============================================================
// MAIN APPLICATION ENTRY POINT
// ============================================================
// Exposes three endpoints:
//   POST /carrier           — Shopify carrier service callback
//   POST /webhooks/products — Product create/update webhook
//   GET  /health            — Health check
// ============================================================

require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const { calculateRates } = require("./lib/rates");
const { fetchProduct, gidToId } = require("./lib/shopify");
const cache = require("./lib/cache");

const app = express();

// Parse raw body for webhook HMAC verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ============================================================
// GET /health
// ============================================================
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    products: cache.getProductCount(),
    variants: cache.getVariantCount(),
  });
});

// ============================================================
// POST /carrier
// Shopify calls this endpoint at checkout for every customer
// who reaches the shipping step.
// ============================================================
app.post("/carrier", (req, res) => {
  try {
    const rates = calculateRates(req.body);

    // If no surcharge applies, return empty rates array so Shopify
    // falls back to its own weight-based rates.
    return res.json({ rates });
  } catch (err) {
    console.error("Carrier error:", err.message);
    // Return empty rates on error — Shopify will use its own rates
    return res.json({ rates: [] });
  }
});

// ============================================================
// POST /webhooks/products
// Shopify sends this when a product is created or updated.
// We re-fetch the product from the API and update the cache.
// ============================================================
app.post("/webhooks/products", async (req, res) => {
  // Verify the webhook is genuinely from Shopify
  if (!verifyWebhook(req)) {
    return res.status(401).send("Unauthorised");
  }

  // Acknowledge immediately — Shopify expects a fast response
  res.status(200).send("OK");

  try {
    const productId = String(req.body.id);
    const productGid = `gid://shopify/Product/${productId}`;

    const product = await fetchProduct(productGid);

    if (!product) {
      // Product was deleted — remove from cache
      cache.deleteProduct(productId);
      console.log(`Product ${productId} removed from cache.`);
      return;
    }

    const boxType = product.metafield ? product.metafield.value : "tee_packet";
    cache.upsertProduct(productId, boxType);

    for (const variantEdge of product.variants.edges) {
      const variantId = gidToId(variantEdge.node.id);
      cache.upsertVariant(variantId, productId);
    }

    console.log(`Product ${productId} updated in cache (box_type: ${boxType})`);
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }
});

// ============================================================
// Webhook HMAC verification
// ============================================================
function verifyWebhook(req) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return true; // Skip verification if secret not set (not recommended for production)

  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (!hmacHeader) return false;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(hmacHeader)
  );
}

// ============================================================
// Start server (local development only)
// Vercel handles this automatically in production.
// ============================================================
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Carrier service running on http://localhost:${PORT}`);
    console.log(`  Products in cache: ${cache.getProductCount()}`);
    console.log(`  Variants in cache: ${cache.getVariantCount()}`);
  });
}

module.exports = app;
