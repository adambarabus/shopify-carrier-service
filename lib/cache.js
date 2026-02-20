// ============================================================
// PRODUCT CACHE — Vercel Edge Config
// ============================================================
// Reads box type lookups from Vercel Edge Config (fast, global).
// Writes are done via the Vercel API when webhooks fire.
//
// Data is stored as two flat keys:
//   "variants" → { "variant_id": "product_id", ... }
//   "products" → { "product_id": "box_type", ... }
// ============================================================

const VALID_BOX_TYPES = ["vinyl_mailer", "cd_mailer", "tee_packet", "can_box"];
const DEFAULT_BOX_TYPE = "tee_packet";

const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const EDGE_CONFIG_URL = process.env.EDGE_CONFIG; // injected automatically by Vercel

// ---- Read from Edge Config ----

async function readKey(key) {
  try {
    // Parse the Edge Config connection string to extract the base URL and token
    // Format: https://edge-config.vercel.com/ecfg_xxx?token=yyy
    const url = new URL(EDGE_CONFIG_URL);
    const fetchUrl = `${url.origin}${url.pathname}/item/${key}${url.search}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

// ---- Write to Edge Config via Vercel API ----

async function writeItems(items) {
  // items: array of { operation: "upsert", key: string, value: any }
  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      },
      body: JSON.stringify({ items }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Edge Config write failed: ${err}`);
  }
  return res.json();
}

// ---- Public API ----

async function upsertProduct(productId, boxType) {
  const resolvedType = VALID_BOX_TYPES.includes(boxType)
    ? boxType
    : DEFAULT_BOX_TYPE;

  const existing = (await readKey("products")) || {};
  existing[String(productId)] = resolvedType;

  await writeItems([{ operation: "upsert", key: "products", value: existing }]);
}

async function upsertVariant(variantId, productId) {
  const existing = (await readKey("variants")) || {};
  existing[String(variantId)] = String(productId);

  await writeItems([{ operation: "upsert", key: "variants", value: existing }]);
}

async function deleteProduct(productId) {
  const pid = String(productId);

  const [products, variants] = await Promise.all([
    readKey("products"),
    readKey("variants"),
  ]);

  const updatedProducts = products || {};
  const updatedVariants = variants || {};

  delete updatedProducts[pid];
  for (const [vid, mappedPid] of Object.entries(updatedVariants)) {
    if (mappedPid === pid) delete updatedVariants[vid];
  }

  await writeItems([
    { operation: "upsert", key: "products", value: updatedProducts },
    { operation: "upsert", key: "variants", value: updatedVariants },
  ]);
}

async function getBoxTypeForVariant(variantId) {
  const [variants, products] = await Promise.all([
    readKey("variants"),
    readKey("products"),
  ]);

  if (!variants || !products) return DEFAULT_BOX_TYPE;

  const productId = variants[String(variantId)];
  if (!productId) return DEFAULT_BOX_TYPE;

  return products[productId] || DEFAULT_BOX_TYPE;
}

async function getProductCount() {
  const products = (await readKey("products")) || {};
  return Object.keys(products).length;
}

async function getVariantCount() {
  const variants = (await readKey("variants")) || {};
  return Object.keys(variants).length;
}

module.exports = {
  upsertProduct,
  upsertVariant,
  deleteProduct,
  getBoxTypeForVariant,
  getProductCount,
  getVariantCount,
};
