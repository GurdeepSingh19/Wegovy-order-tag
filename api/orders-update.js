import crypto from 'crypto';
import axios from 'axios';

const PRODUCT_SKU_TO_CHECK = '9000000';
const TAG_TO_ADD = 'prescription-required';
const DELAY_MINUTES_ON_CREATE = 1;

function verifyHmac(req, body, secret) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hmacHeader || '', 'base64'), Buffer.from(hash));

    console.log('HMAC verification failed. Invalid signature.');
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function addTagIfNeeded(order, shop, accessToken) {
    const hasSku = order.line_items?.some(item => item.sku === PRODUCT_SKU_TO_CHECK);
    console.log(`Checking order ${order.id} for SKU ${PRODUCT_SKU_TO_CHECK}`);
    if (!hasSku) return;    

    const currentTags = order.tags?.split(',').map(t => t.trim()) || [];

    console.log(`Current tags for order ${order.id}:`, currentTags);
    if (currentTags.includes(TAG_TO_ADD)) return;

    console.log(`Adding tag "${TAG_TO_ADD}" to order ${order.id}`);
    const newTags = [...currentTags, TAG_TO_ADD];
    await axios.put(`https://${shop}/admin/api/2025-07/orders/${order.id}.json`, {
        order: { id: order.id, tags: newTags.join(', ') }
    }, {
        headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
        }
    });
}

export default async function handler(req, res) {
    console.log('Webhook received');

    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    let body = '';
    try {
        body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => resolve(data));
            req.on('error', reject);
        });
    } catch (e) {
        return res.status(400).send('Invalid body');
    }

    console.log('Received body:', body);
    const { SHOPIFY_SHARED_SECRET, SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP } = process.env;

    if (process.env.SKIP_HMAC_CHECK === 'true') {
        console.log('⚠️ Skipping HMAC check for testing');
    } else if (!verifyHmac(req, body, SHOPIFY_SHARED_SECRET)) {
        return res.status(401).send('Unauthorized');
        console.log('❌ Invalid HMAC signature.');
    }

    console.log("📩 Webhook HIT at /webhooks/orders-update");

    const order = JSON.parse(body);
    console.log(`✅ Verified webhook: Order ID ${order.id}`);

    await delay(DELAY_MINUTES_ON_CREATE * 60 * 1000);
    await addTagIfNeeded(order, SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN);
    console.log(`✅ Order ${order.id} processed`);
    res.status(200).send('OK');
}
