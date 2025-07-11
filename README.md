# Wegovy Order Tagger (Shopify Webhook App)

This is a lightweight Node.js webhook service for Shopify that listens to `orders/update` events and adds a specific tag (`prescription-required`) to orders containing a specific product SKU.

---

## 📦 Features

- ✅ Verifies incoming webhooks using Shopify HMAC signature
- ✅ Scans line items in each order for a specific SKU
- ✅ Automatically appends a custom tag to qualified orders
- ✅ Delays tagging to ensure Shopify order sync
- ✅ Uses `Express` and `raw-body` for proper webhook handling

---

## 🛠️ Tech Stack

- Node.js
- Express
- Shopify Webhooks
- dotenv
- Axios

---

## 🚀 Setup & Installation

1. **Clone this repository:**

```bash
git clone https://github.com/GurdeepSingh19/Wegovy-order-tag.git
cd Wegovy-order-tag
Install dependencies:

bash
Copy
Edit
npm install
Create a .env file:

bash
Copy
Edit
cp .env.example .env
Fill in your .env file:

env
Copy
Edit
SHOPIFY_SHARED_SECRET=your-shopify-app-secret
SHOPIFY_ACCESS_TOKEN=your-admin-api-access-token
SHOPIFY_SHOP=your-store.myshopify.com
PORT=3002
SKIP_HMAC_CHECK=false  # set to true ONLY for local testing
🧪 Test Locally
To test locally, use a tool like ngrok to expose your local server:

bash
Copy
Edit
npx ngrok http 3002
Then set this ngrok URL in your Shopify admin for the orders/update webhook.

🕸️ Endpoints
POST /webhooks/orders-update
Shopify will POST to this endpoint when an order is created/updated.

The app will:

Verify the webhook with HMAC

Parse the order

Look for the product with SKU 9000000

If found, add the tag prescription-required

🧰 File Structure
bash
Copy
Edit
.
├── api
│   └── orders-update.js   # Webhook handler
├── index.js               # Express app entry point
├── .env                   # Environment variables
├── package.json
└── README.md              # You're here
📤 Deploy to Render
Push your code to a GitHub repo.

Create a new Web Service on Render.

Set the Build Command to:

nginx
Copy
Edit
npm install
Set the Start Command to:

nginx
Copy
Edit
node index.js
Add the following environment variables in the Render dashboard:

SHOPIFY_SHARED_SECRET

SHOPIFY_ACCESS_TOKEN

SHOPIFY_SHOP

PORT (optional, Render provides one)

🛡️ HMAC Verification
All webhooks from Shopify are verified using HMAC (SHA256) based on the request body and shared secret.

If the signature is invalid, the webhook will return a 401 Unauthorized.

❓ Troubleshooting
❌ stream is not readable — Make sure you're using express.raw({ type: 'application/json' }) in index.js.

❌ HMAC verification failed — Check if your webhook secret matches exactly.

❌ Input buffers must have the same byte length — This is fixed in the latest verifyHmac() function.

👤 Author
Made with ❤️ by Gurdeep Singh
