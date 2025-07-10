import crypto from 'crypto';
import axios from 'axios';

const PRODUCT_SKU_TO_CHECK = '9000000';
const TAG_TO_ADD = 'prescription-verified';

function verifyHMAC(req, secret) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const rawBody = req.body;

    if (!hmacHeader || !rawBody) return false;

    const generatedHash = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

    return crypto.timingSafeEqual(
        Buffer.from(hmacHeader, 'base64'),
        Buffer.from(generatedHash, 'base64')
    );
}

export default async function ordersCreateHandler(req, res) {
    console.log("📩 Webhook HIT at /webhooks/orders-create");

    const { SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP, SHOPIFY_SHARED_SECRET } = process.env;

    if (!verifyHMAC(req, SHOPIFY_SHARED_SECRET)) {
        console.warn("❌ Invalid HMAC signature.");
        return res.status(401).send("Unauthorized");
    }

    const order = JSON.parse(req.body.toString('utf8'));
    res.status(200).send("Webhook received");

    const hasTargetProduct = order.line_items?.some(item => item.sku === PRODUCT_SKU_TO_CHECK);
    if (!hasTargetProduct) return;

    const existingTags = order.tags?.split(',').map(t => t.trim()) || [];
    if (!existingTags.includes(TAG_TO_ADD)) existingTags.push(TAG_TO_ADD);

    try {
        await axios.put(
            `https://${SHOPIFY_SHOP}/admin/api/2025-07/orders/${order.id}.json`,
            { order: { id: order.id, tags: existingTags.join(', ') } },
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`✅ Order ${order.id} tagged successfully`);
    } catch (err) {
        console.error('❌ Error tagging order:', err.message);
    }
}
