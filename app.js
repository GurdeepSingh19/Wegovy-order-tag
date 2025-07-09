import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import ordersCreateHandler from './ordersCreate.js';

const app = express();

// Use raw body parser only on webhook route to verify HMAC correctly
app.post(
    '/webhooks/orders-create',
    express.raw({ type: 'application/json' }),
    ordersCreateHandler
);


const PORT = process.env.PORT || 3000;
console.log("✅ Environment variables loaded:", {
    SHOPIFY_SHARED_SECRET: process.env.SHOPIFY_SHARED_SECRET,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_SHOP: process.env.SHOPIFY_SHOP
});
app.listen(PORT, () => console.log(`🚀 Webhook server running on port ${PORT}`));
