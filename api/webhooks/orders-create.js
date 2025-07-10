import crypto from 'crypto';
import axios from 'axios';

const PRODUCT_SKU_TO_CHECK = '9000000';
const TAG_TO_ADD = 'prescription-required';
const DELAY_MINUTES_ON_CREATE = 10;

function verifyHmac(req, body, secret) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
    const isValid = crypto.timingSafeEqual(Buffer.from(hmacHeader || '', 'base64'), Buffer.from(hash));
    console.log(`🔐 HMAC validation: ${isValid ? 'passed' : 'failed'}`);
    return isValid;
}

async function delay(ms) {
    console.log(`⏳ Waiting for ${ms / 1000} seconds before processing`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function addTagIfNeeded(order, shop, accessToken) {
    console.log(`🔍 Checking for SKU ${PRODUCT_SKU_TO_CHECK} in order ${order.id}`);
    const hasSku = order.line_items?.some(item => {
        console.log(` - SKU found in line item: ${item.sku}`);
        return item.sku === PRODUCT_SKU_TO_CHECK;
    });

    if (!hasSku) {
        console.log(`❌ SKU ${PRODUCT_SKU_TO_CHECK} not found in order ${order.id}. No tag added.`);
        return;
    }

    const currentTags = order.tags?.split(',').map(t => t.trim()) || [];
    console.log(`📝 Current tags on order ${order.id}: [${currentTags.join(', ')}]`);

    if (currentTags.includes(TAG_TO_ADD)) {
        console.log(`✅ Tag "${TAG_TO_ADD}" already present on order ${order.id}. Skipping update.`);
        return;
    }

    const newTags = [...currentTags, TAG_TO_ADD];
    console.log(`✏️ Adding tag "${TAG_TO_ADD}" to order ${order.id}. New tags: [${newTags.join(', ')}]`);

    try {
        const response = await axios.put(`https://${shop}/admin/api/2025-07/orders/${order.id}.json`, {
            order: { id: order.id, tags: newTags.join(', ') }
        }, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Successfully updated order ${order.id} tags`, response.data);
    } catch (error) {
        console.error(`❌ Failed to update tags for order ${order.id}`, error.response?.data || error.message);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        console.log('🚫 Method not allowed:', req.method);
        return res.status(405).end('Method Not Allowed');
    }

    let body = '';
    try {
        body = await readBody(req);
    } catch (error) {
        console.error('❌ Error reading request body:', error);
        return res.status(400).send('Invalid body');
    }
    console.log('📥 Raw webhook body:', body);

    const { SHOPIFY_SHARED_SECRET, SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP } = process.env;

    console.log('🛠️ Env vars:', {
        SHOPIFY_SHARED_SECRET: !!SHOPIFY_SHARED_SECRET,
        SHOPIFY_ACCESS_TOKEN: !!SHOPIFY_ACCESS_TOKEN,
        SHOPIFY_SHOP
    });

    if (!verifyHmac(req, body, SHOPIFY_SHARED_SECRET)) {
        console.log('❌ Invalid HMAC signature.');
        return res.status(401).send('Unauthorized');
    }

    let order;
    try {
        order = JSON.parse(body);
        console.log(`✅ Verified webhook: Order ID ${order.id}`);
    } catch (error) {
        console.error('❌ Failed to parse JSON body:', error);
        return res.status(400).send('Invalid JSON');
    }

    await delay(DELAY_MINUTES_ON_CREATE * 60 * 1000);

    try {
        await addTagIfNeeded(order, SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN);
    } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, error);
    }

    console.log(`✅ Order ${order.id} processed successfully.`);
    res.status(200).send('OK');
}

// Reads raw body
async function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}
