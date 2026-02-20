// ============================================================
// PRODUCT CACHE
// ============================================================
// Maintains a local SQLite database mapping:
//   variant_id  →  product_id  →  box_type
//
// This avoids calling the Shopify API on every checkout request,
// keeping response times fast and well within Shopify's 10s limit.
// ============================================================

const Database = require("better-sqlite3");
const path = require("path");

// In Vercel serverless, /tmp is the only writable directory
const DB_PATH = process.env.DB_PATH || path.join("/tmp", "cache.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initialise();
  }
  return db;
}

function initialise() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS products (
      product_id   TEXT PRIMARY KEY,
      box_type     TEXT NOT NULL DEFAULT 'tee_packet'
    );

    CREATE TABLE IF NOT EXISTS variants (
      variant_id   TEXT PRIMARY KEY,
      product_id   TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
  `);
}

// ---- Write operations ----

function upsertProduct(productId, boxType) {
  const validTypes = ["vinyl_mailer", "cd_mailer", "tee_packet", "can_box"];
  const resolvedType = validTypes.includes(boxType) ? boxType : "tee_packet";

  getDb()
    .prepare(
      `INSERT INTO products (product_id, box_type)
       VALUES (?, ?)
       ON CONFLICT(product_id) DO UPDATE SET box_type = excluded.box_type`
    )
    .run(productId, resolvedType);
}

function upsertVariant(variantId, productId) {
  getDb()
    .prepare(
      `INSERT INTO variants (variant_id, product_id)
       VALUES (?, ?)
       ON CONFLICT(variant_id) DO UPDATE SET product_id = excluded.product_id`
    )
    .run(variantId, productId);
}

function deleteProduct(productId) {
  getDb().prepare(`DELETE FROM variants WHERE product_id = ?`).run(productId);
  getDb().prepare(`DELETE FROM products WHERE product_id = ?`).run(productId);
}

// ---- Read operations ----

function getBoxTypeForVariant(variantId) {
  const row = getDb()
    .prepare(
      `SELECT p.box_type
       FROM variants v
       JOIN products p ON v.product_id = p.product_id
       WHERE v.variant_id = ?`
    )
    .get(variantId);

  // Default to tee_packet if variant not found in cache
  return row ? row.box_type : "tee_packet";
}

function getProductCount() {
  return getDb().prepare(`SELECT COUNT(*) as count FROM products`).get().count;
}

function getVariantCount() {
  return getDb().prepare(`SELECT COUNT(*) as count FROM variants`).get().count;
}

module.exports = {
  upsertProduct,
  upsertVariant,
  deleteProduct,
  getBoxTypeForVariant,
  getProductCount,
  getVariantCount,
};
