// ============================================================
// SHOPIFY API CLIENT
// ============================================================
// Uses the client credentials grant flow to obtain and
// automatically refresh access tokens. Tokens expire after
// 24 hours so we refresh proactively before they expire.
// ============================================================

const https = require("https");

const SHOP = process.env.SHOPIFY_SHOP;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

// In-memory token store — refreshed automatically when near expiry
let tokenCache = {
  accessToken: null,
  expiresAt: null,
};

// ---- Token management ----

/**
 * Returns a valid access token, requesting a new one if the
 * current token is missing or within 5 minutes of expiry.
 */
async function getAccessToken() {
  const fiveMinutes = 5 * 60 * 1000;
  const now = Date.now();

  if (
    tokenCache.accessToken &&
    tokenCache.expiresAt &&
    now < tokenCache.expiresAt - fiveMinutes
  ) {
    return tokenCache.accessToken;
  }

  return await refreshAccessToken();
}

/**
 * Fetches a fresh access token from Shopify using the
 * client credentials grant flow.
 */
function refreshAccessToken() {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString();

    const options = {
      hostname: SHOP,
      path: "/admin/oauth/access_token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.access_token) {
            reject(new Error(`Token request failed: ${data}`));
            return;
          }
          tokenCache.accessToken = parsed.access_token;
          tokenCache.expiresAt = Date.now() + parsed.expires_in * 1000;
          console.log("Shopify access token refreshed successfully.");
          resolve(parsed.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---- GraphQL ----

async function graphql(query, variables = {}) {
  const token = await getAccessToken();
  const body = JSON.stringify({ query, variables });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: SHOP,
      path: "/admin/api/2024-01/graphql.json",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---- Product queries ----

async function fetchProductPage(cursor = null) {
  const query = `
    query fetchProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            metafield(namespace: "packaging", key: "box_type") {
              value
            }
            variants(first: 100) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await graphql(query, { cursor });
  return data.products;
}

async function fetchProduct(productGid) {
  const query = `
    query fetchProduct($id: ID!) {
      product(id: $id) {
        id
        metafield(namespace: "packaging", key: "box_type") {
          value
        }
        variants(first: 100) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;

  const data = await graphql(query, { id: productGid });
  return data.product;
}

function gidToId(gid) {
  return gid.split("/").pop();
}

module.exports = { fetchProductPage, fetchProduct, gidToId, getAccessToken };
