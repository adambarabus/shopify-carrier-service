# Shopify Carrier Service — Oversized Packaging Surcharge

Applies a configurable shipping surcharge at checkout when a customer's order contains both **Vinyl Mailer** and **Can Box** items, which require a larger combined box to ship together.

---

## How It Works

1. Shopify calls this service at checkout with the customer's cart contents
2. The service checks each item's packaging category (stored as a product metafield)
3. If the order contains both `vinyl_mailer` and `can_box` items, a surcharge rate is returned
4. Otherwise, the service returns nothing and Shopify uses its normal weight-based rates

---

## Setup Guide

Follow these steps in order. The whole process takes approximately 30–60 minutes.

---

### Step 1 — Create a Custom App in Your Shopify Admin

1. In your Shopify admin go to **Settings → Apps and sales channels**
2. Click **Develop apps** (enable developer mode if prompted)
3. Click **Create an app**, give it a name like `Carrier Service`, and click **Create**
4. Go to **Configuration → Admin API integration**
5. Enable these scopes: `read_products` and `write_shipping`
6. Click **Save**
7. Go to the **API credentials** tab
8. Click **Install app** and confirm — this installs the app on your store
9. Note down your **Client ID** and **Client Secret** from the Settings page — you will need both shortly

> The Client Secret is used both to obtain API access tokens and to verify that incoming webhooks are genuinely from Shopify. Keep it safe and never commit it to GitHub.

---

### Step 2 — Set Up the Metafield Definition in Shopify

1. In your Shopify admin, go to **Settings → Custom data → Products**
2. Click **Add definition**
3. Fill in:
   - **Name:** `Box Type`
   - **Namespace and key:** `packaging.box_type`
   - **Type:** Single line text
4. Click **Save**

You now have a `Box Type` field visible on every product page in the admin.

---

### Step 3 — Tag Your Products

For every product in your catalogue, go to the product page in the Shopify admin and scroll to the **Metafields** section at the bottom. Set `Box Type` to one of the following values (type exactly as shown):

| Packaging | Value to enter |
|-----------|---------------|
| Vinyl Mailer | `vinyl_mailer` |
| CD Mailer | `cd_mailer` |
| Tee Packet / Envelope | `tee_packet` |
| Can Box | `can_box` |

> **Note:** Products with no value set will default to `tee_packet` at runtime.

---

### Step 4 — Set Up the GitHub Repository

1. Go to [github.com](https://github.com) and create a new **private** repository called `shopify-carrier-service`
2. Leave it empty (no README)
3. On your computer, open your terminal, unzip the project folder, and run:

```bash
cd shopify-carrier-service

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/shopify-carrier-service.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

---

### Step 5 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up / log in with your GitHub account
2. Click **Add New → Project**
3. Find and import your `shopify-carrier-service` repository
4. Before clicking Deploy, open **Environment Variables** and add the following:

| Name | Value |
|------|-------|
| `SHOPIFY_SHOP` | `3hvdwy-f0.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | *(your Client ID from Step 1)* |
| `SHOPIFY_CLIENT_SECRET` | *(your Client Secret from Step 1)* |

5. Click **Deploy**
6. Once deployed, copy your Vercel URL — it will look like `https://shopify-carrier-service-xxxx.vercel.app`

---

### Step 6 — Register the Carrier Service with Shopify

Run the following in your terminal (replace the placeholders):

```bash
curl -X POST \
  https://3hvdwy-f0.myshopify.com/admin/api/2024-01/carrier_services.json \
  -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "carrier_service": {
      "name": "Oversized Packaging Surcharge",
      "callback_url": "https://YOUR_VERCEL_URL/carrier",
      "service_discovery": false
    }
  }'
```

> To get `YOUR_ACCESS_TOKEN` for this one-time setup command, run the following first:
> ```bash
> curl -X POST https://3hvdwy-f0.myshopify.com/admin/oauth/access_token \
>   -H "Content-Type: application/x-www-form-urlencoded" \
>   -d "grant_type=client_credentials" \
>   -d "client_id=YOUR_CLIENT_ID" \
>   -d "client_secret=YOUR_CLIENT_SECRET"
> ```
> Copy the `access_token` value from the response and use it above.

---

### Step 7 — Register Webhooks

Using the same access token from Step 6, run:

```bash
# products/create
curl -X POST \
  https://3hvdwy-f0.myshopify.com/admin/api/2024-01/webhooks.json \
  -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "products/create",
      "address": "https://YOUR_VERCEL_URL/webhooks/products",
      "format": "json"
    }
  }'

# products/update
curl -X POST \
  https://3hvdwy-f0.myshopify.com/admin/api/2024-01/webhooks.json \
  -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "products/update",
      "address": "https://YOUR_VERCEL_URL/webhooks/products",
      "format": "json"
    }
  }'
```

---

### Step 8 — Run the Initial Cache Sync

This populates the local cache with all your existing products.

```bash
# Create your local .env file
cp .env.example .env

# Edit .env and fill in your SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET
# (use any text editor)

# Install dependencies
npm install

# Run the sync
npm run sync
```

You should see output listing how many products and variants were synced.

---

### Step 9 — Set Your Surcharge Amounts

Open `lib/surcharges.js` and replace the `0` values with your actual surcharge amounts **in minor units** (pence/cents):

```js
GB: { amount: 500, currency: "GBP" },  // = £5.00
US: { amount: 750, currency: "USD" },  // = $7.50
```

Commit and push to GitHub — Vercel redeploys automatically.

---

## Checking It's Working

Visit your health endpoint in a browser:

```
https://YOUR_VERCEL_URL/health
```

You should see:
```json
{ "status": "ok", "products": 142, "variants": 380 }
```

To test the surcharge, add a Vinyl Mailer product and a Can Box product to a cart and proceed to checkout. The oversized packaging rate should appear.

---

## Making Changes

**Changing surcharge amounts** — edit `lib/surcharges.js`, commit, and push.

**Changing the rate label shown to customers** — edit `SURCHARGE_RATE_LABEL` in `lib/rates.js`, commit, and push.

**Re-syncing all products** (e.g. after bulk metafield updates) — run `npm run sync`.

**Adding a new country** — add an entry to `lib/surcharges.js` using the ISO 3166-1 alpha-2 country code.

---

## File Structure

```
shopify-carrier-service/
├── index.js                  # Main app — HTTP endpoints
├── vercel.json               # Vercel deployment config
├── package.json
├── .env.example              # Copy to .env for local dev
├── .gitignore
├── lib/
│   ├── cache.js              # SQLite product cache
│   ├── rates.js              # Core surcharge logic
│   ├── shopify.js            # Shopify API client (client credentials)
│   └── surcharges.js         # Per-market surcharge config
└── scripts/
    └── sync.js               # Initial product sync script
```
