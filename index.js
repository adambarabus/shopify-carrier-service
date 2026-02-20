require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const { calculateRates } = require("./lib/rates");
const { fetchProduct, gidToId } = require("./lib/shopify");
const cache = require("./lib/cache");

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    products: await cache.getProductCount(),
    variants: await cache.getVariantCount(),
  });
});

app.post("/carrier", async (req, res) => {
  try {
    const rates = await calculateRates(req.body);
    return res.json({ rates });
  } catch (err) {
    console.error("Carrier error:", err.message);
    return res.json({ rates: [] });
  }
});

app.post("/webhooks/products", async (req, res) => {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];

  if (secret && hmacHeader) {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("base64");
    const valid = crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(hmacHeader)
    );
    if (!valid) return res.status(401).send("Unauthorised");
  }

  res.status(200).send("OK");

  try {
    const productId = String(req.body.id);
    const productGid = `gid://shopify/Product/${productId}`;
    const product = await fetchProduct(productGid);

    if (!product) {
      await cache.deleteProduct(productId);
      return;
    }

    const boxType = product.metafield ? product.metafield.value : "tee_packet";
    await cache.upsertProduct(productId, boxType);

    for (const variantEdge of product.variants.edges) {
      const variantId = gidToId(variantEdge.node.id);
      await cache.upsertVariant(variantId, productId);
    }

    console.log(`Product ${productId} cached (box_type: ${boxType})`);
  } catch (err) {
    console.error("Webhook error:", err.message);
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Carrier service running on http://localhost:${PORT}`);
  });
}

module.exports = app;
