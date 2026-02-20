// ============================================================
// INITIAL PRODUCT SYNC SCRIPT
// ============================================================
// Run this once after deployment to populate the local cache
// with all products and their packaging metafields.
//
// Usage:
//   node scripts/sync.js
//
// You can also re-run this at any time to force a full refresh
// of the cache (e.g. after bulk-updating metafields).
// ============================================================

require("dotenv").config();

const { fetchProductPage, gidToId } = require("../lib/shopify");
const cache = require("../lib/cache");

async function sync() {
  console.log("Starting full product sync...\n");

  let cursor = null;
  let hasNextPage = true;
  let totalProducts = 0;
  let totalVariants = 0;

  while (hasNextPage) {
    const page = await fetchProductPage(cursor);

    for (const edge of page.edges) {
      const product = edge.node;
      const productId = gidToId(product.id);
      const boxType = product.metafield ? product.metafield.value : null;

      cache.upsertProduct(productId, boxType || "tee_packet");

      for (const variantEdge of product.variants.edges) {
        const variantId = gidToId(variantEdge.node.id);
        cache.upsertVariant(variantId, productId);
        totalVariants++;
      }

      totalProducts++;
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;

    console.log(`  Synced ${totalProducts} products, ${totalVariants} variants so far...`);
  }

  console.log(`\nSync complete.`);
  console.log(`  Products in cache: ${cache.getProductCount()}`);
  console.log(`  Variants in cache: ${cache.getVariantCount()}`);
}

sync().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
