require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

const PRODUCT_SKU_TO_CHECK = '9000000';
const TAG_TO_ADD = 'prescription-required';
const DELAY_MINUTES_ON_CREATE = 10;

function verifyHmac(req, secret) {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    if (!hmacHeader) return false;
    const hash = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
    try {
        return crypto.timingSafeEqual(Buffer.from(hmacHeader, 'base64'), Buffer.from(hash, 'base64'));
    } catch {
        return false;
    }
}

async function getOrderCurrentTags(orderId, shop, accessToken) {
    try {
        const url = `https://${shop}/admin/api/2025-07/orders/${orderId}.json`;
        const resp = await axios.get(url, {
            headers: { 'X-Shopify-Access-Token': accessToken },
        });
        const currentTags = resp.data.order.tags || '';
        return currentTags.split(',').map(t => t.trim()).filter(Boolean);
    } catch (error) {
        console.error(`❌ Error fetching current tags for order ${orderId}:`, error.response?.data || error.message);
        return [];
    }
}

async function addTagIfNeeded(order, shop, accessToken, existingTags) {
    console.log(`📦 Order ${order.id} has ${order.line_items?.length || 0} line items:`);

    for (const item of order.line_items || []) {
        console.log(`  ➤ Title: "${item.title}", SKU: "${item.sku}"`);
    }

    const hasTargetProduct = order.line_items?.some(item => item.sku === PRODUCT_SKU_TO_CHECK);

    if (!hasTargetProduct) {
        console.log(`❌ SKU ${PRODUCT_SKU_TO_CHECK} not found in order.`);
        return;
    }

    let tags = existingTags || (order.tags ? order.tags.split(',').map(t => t.trim()) : []);

    if (tags.includes(TAG_TO_ADD)) {
        console.log(`ℹ️ Order ${order.id} already has tag '${TAG_TO_ADD}'.`);
        return;
    }

    tags.push(TAG_TO_ADD);

    try {
        const url = `https://${shop}/admin/api/2025-07/orders/${order.id}.json`;
        await axios.put(
            url,
            { order: { id: order.id, tags: tags.join(', ') } },
            {
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`✅ Tag '${TAG_TO_ADD}' added to order ${order.id}`);
    } catch (error) {
        console.error(`❌ Failed to tag order ${order.id}:`, error.response?.data || error.message);
    }
}


async function webhookHandler(req, res, isCreate = false) {
    const secret = process.env.SHOPIFY_SHARED_SECRET;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const shop = process.env.SHOPIFY_SHOP;

    if (!secret || !accessToken || !shop) {
        console.error('❗ Missing environment variables');
        return res.status(500).send('Server error');
    }

    if (!verifyHmac(req, secret)) {
        console.log('❌ Invalid HMAC – Webhook not verified');
        return res.status(401).send('Unauthorized');
    }

    const order = JSON.parse(req.body.toString('utf8'));
    console.log(`✅ Verified webhook for order: ${order.id}`);

    res.status(200).send('Webhook received');

    if (isCreate) {
        console.log(`⏳ Waiting ${DELAY_MINUTES_ON_CREATE} minutes before tagging order ${order.id}...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MINUTES_ON_CREATE * 60 * 1000));
        await addTagIfNeeded(order, shop, accessToken);
    } else {
        // For update webhook: check if tags changed
        const webhookTags = order.tags ? order.tags.split(',').map(t => t.trim()) : [];
        const currentTags = await getOrderCurrentTags(order.id, shop, accessToken);

        // Compare tags arrays (simple check)
        const tagsChanged =
            webhookTags.length !== currentTags.length ||
            webhookTags.some(t => !currentTags.includes(t)) ||
            currentTags.some(t => !webhookTags.includes(t));

        if (!tagsChanged) {
            console.log(`ℹ️ No tag change detected for order ${order.id}, skipping.`);
            return;
        }

        console.log(`ℹ️ Tag change detected for order ${order.id}, checking SKU and updating tag if needed...`);
        await addTagIfNeeded(order, shop, accessToken, webhookTags);
    }
}

app.post('/webhooks/orders-create', express.raw({ type: 'application/json' }), async (req, res) => {
    await webhookHandler(req, res, true);
});

app.post('/webhooks/orders-update', express.raw({ type: 'application/json' }), async (req, res) => {
    await webhookHandler(req, res, false);
});

app.listen(3002, () => console.log('Server running on port 3002'));
