// ============================================================
// MANUAL CACHE WRITER
// ============================================================
// Run this script to manually write product data to Edge Config
// bypassing the webhook flow entirely.
//
// Usage: node scripts/write-cache.js
// ============================================================

require("dotenv").config();

const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;

async function writeToEdgeConfig(variants, products) {
  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          { operation: "upsert", key: "variants", value: variants },
          { operation: "upsert", key: "products", value: products },
        ],
      }),
    }
  );

  const data = await res.json();
  console.log("Edge Config write response:", JSON.stringify(data, null, 2));
  return data;
}

async function readFromEdgeConfig(key) {
  const url = new URL(process.env.EDGE_CONFIG);
  const fetchUrl = `${url.origin}${url.pathname}/item/${key}${url.search}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  console.log("Reading current Edge Config state...");
  const currentVariants = await readFromEdgeConfig("variants");
  const currentProducts = await readFromEdgeConfig("products");
  console.log("Current variants:", JSON.stringify(currentVariants));
  console.log("Current products:", JSON.stringify(currentProducts));

  // ============================================================
  // EDIT THESE VALUES to match your actual product/variant IDs
  // You can find these in your Shopify admin:
  //   Product ID: in the URL when editing a product
  //   Variant ID: in the URL when editing a variant, or via API
  // ============================================================
  const products = {
    // "PRODUCT_ID": "box_type"
    // Example: "8765432109876": "vinyl_mailer"
    ...currentProducts,
  };

  const variants = {
    // "VARIANT_ID": "PRODUCT_ID"  
    // Example: "47654321098765": "8765432109876"
    ...currentVariants,
  };

  // ============================================================
  // To find your IDs, run this command and look at the output:
  // ============================================================
  console.log("\nTo find your product and variant IDs, run:");
  console.log(`curl https://3hvdwy-f0.myshopify.com/admin/api/2024-01/products.json?fields=id,title,variants -H "X-Shopify-Access-Token: YOUR_TOKEN"\n`);

  if (Object.keys(products).length === 0) {
    console.log("No products configured yet. Edit scripts/write-cache.js to add your product and variant IDs.");
    return;
  }

  console.log("Writing to Edge Config...");
  await writeToEdgeConfig(variants, products);
  console.log("Done.");
}

main().catch(console.error);
