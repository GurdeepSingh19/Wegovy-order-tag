import crypto from 'crypto';
import axios from 'axios';

const PRODUCT_SKU_TO_CHECK = '9000000'; // Your SKU here
const TAG_TO_ADD = 'prescription-verified';
const DELAY_MINUTES = 0;

function verifyHMAC(req, secret) {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const rawBody = req.body;

    if (!hmacHeader || !rawBody) {
        console.error('❗ Missing HMAC header or body');
        return false;
    }

    const generatedHash = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

    console.log("📦 Header HMAC:", hmacHeader);
    console.log("🔐 Generated HMAC:", generatedHash);

    const receivedHMAC = Buffer.from(hmacHeader, 'base64');
    const expectedHMAC = Buffer.from(generatedHash, 'base64');

    try {
        return crypto.timingSafeEqual(receivedHMAC, expectedHMAC);
    } catch (e) {
        console.error('❗ HMAC comparison failed:', e.message);
        return false;
    }
}

export default async function ordersCreateHandler(req, res) {
    console.log("📩 Webhook HIT at /webhooks/orders-create");
    console.log("Type of req.body:", typeof req.body);
    console.log("Is Buffer:", Buffer.isBuffer(req.body));
    console.log("🔍 Raw body preview:", req.body.toString('utf8').slice(0, 200));

    const { SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP, SHOPIFY_SHARED_SECRET } = process.env;

    if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_SHOP || !SHOPIFY_SHARED_SECRET) {
        console.error("❗ Missing required environment variables");
        return res.status(500).send("Server error");
    }

    const hmacValid = verifyHMAC(req, SHOPIFY_SHARED_SECRET);

    if (!hmacValid) {
        console.warn("❌ Invalid HMAC signature.");
        return res.status(401).send("Unauthorized");
    }

    const order = JSON.parse(req.body.toString('utf8'));

    // Respond early to avoid Shopify timeout
    res.status(200).send("Webhook received");

    const hasTargetProduct = order.line_items?.some(
        (item) => item.sku === PRODUCT_SKU_TO_CHECK
    );

    if (!hasTargetProduct) {
        console.log("ℹ️ Product SKU not found in order.");
        return;
    }

    const existingTags = order.tags?.split(',').map(t => t.trim()) || [];
    if (!existingTags.includes(TAG_TO_ADD)) existingTags.push(TAG_TO_ADD);

    try {
        if (DELAY_MINUTES > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MINUTES * 60 * 1000));
        }

        await axios.put(
            `https://${SHOPIFY_SHOP}/admin/api/2025-07/orders/${order.id}.json`,
            {
                order: {
                    id: order.id,
                    tags: existingTags.join(', ')
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Order ${order.id} tagged successfully`);
    } catch (err) {
        console.error('❌ Error updating order tags:', err.message);
    }
}
