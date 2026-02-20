// ============================================================
// PRODUCT CACHE
// ============================================================
// In-memory cache mapping:
//   variant_id  →  product_id  →  box_type
//
// Vercel serverless functions are stateless — the cache is
// rebuilt automatically via Shopify webhooks each time a
// product is created or updated. The initial sync script
// populates it on first warm-up.
// ============================================================

// variant_id (string) → product_id (string)
const variantToProduct = new Map();

// product_id (string) → box_type (string)
const productToBoxType = new Map();

const VALID_BOX_TYPES = ["vinyl_mailer", "cd_mailer", "tee_packet", "can_box"];
const DEFAULT_BOX_TYPE = "tee_packet";

// ---- Write operations ----

function upsertProduct(productId, boxType) {
  const resolvedType = VALID_BOX_TYPES.includes(boxType)
    ? boxType
    : DEFAULT_BOX_TYPE;
  productToBoxType.set(String(productId), resolvedType);
}

function upsertVariant(variantId, productId) {
  variantToProduct.set(String(variantId), String(productId));
}

function deleteProduct(productId) {
  const pid = String(productId);
  productToBoxType.delete(pid);
  // Remove all variants that pointed to this product
  for (const [vid, mappedPid] of variantToProduct.entries()) {
    if (mappedPid === pid) variantToProduct.delete(vid);
  }
}

// ---- Read operations ----

function getBoxTypeForVariant(variantId) {
  const productId = variantToProduct.get(String(variantId));
  if (!productId) return DEFAULT_BOX_TYPE;
  return productToBoxType.get(productId) || DEFAULT_BOX_TYPE;
}

function getProductCount() {
  return productToBoxType.size;
}

function getVariantCount() {
  return variantToProduct.size;
}

module.exports = {
  upsertProduct,
  upsertVariant,
  deleteProduct,
  getBoxTypeForVariant,
  getProductCount,
  getVariantCount,
};
