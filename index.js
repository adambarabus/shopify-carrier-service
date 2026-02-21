require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { calculateRates, bustConfigCache } = require("./lib/rates");
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

// ---- Admin UI ----
app.get("/admin", (_req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const edgeConfigUrl = process.env.EDGE_CONFIG;
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const vercelApiToken = process.env.VERCEL_API_TOKEN;

  if (!adminPassword) {
    return res.status(500).send("ADMIN_PASSWORD environment variable not set.");
  }

  let html = fs.readFileSync(path.join(__dirname, "admin", "index.html"), "utf8");
  html = html
    .replace("__ADMIN_PASSWORD__", adminPassword)
    .replace("__EDGE_CONFIG_URL__", edgeConfigUrl || "")
    .replace("__EDGE_CONFIG_ID__", edgeConfigId || "")
    .replace("__VERCEL_API_TOKEN__", vercelApiToken || "");

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ---- Cache bust endpoint — called by admin UI after save ----
app.post("/admin/bust-cache", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || authHeader !== adminPassword) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  bustConfigCache();
  res.json({ ok: true });
});

// ---- Health ----
app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    products: await cache.getProductCount(),
    variants: await cache.getVariantCount(),
  });
});

// ---- Carrier ----
app.post("/carrier", async (req, res) => {
  try {
    const rates = await calculateRates(req.body);
    return res.json({ rates });
  } catch (err) {
    console.error("Carrier error:", err.message);
    return res.json({ rates: [] });
  }
});

// ---- Webhooks ----
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
