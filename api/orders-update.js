import crypto from 'crypto';
import axios from 'axios';
import getRawBody from 'raw-body';

const PRODUCT_SKU_TO_CHECK = '9000000';
const TAG_TO_ADD = 'prescription-required';
const DELAY_MINUTES_ON_CREATE = 0;

function verifyHmac(req, body, secret) {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    if (!hmacHeader) {
        console.log('❌ Missing HMAC header.');
        return false;
    }
    const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');

    const bufferHeader = Buffer.from(hmacHeader, 'base64');
    const bufferHash = Buffer.from(hash, 'base64');

    if (bufferHeader.length !== bufferHash.length) {
        console.log(`❌ HMAC length mismatch. Header length: ${bufferHeader.length}, Computed length: ${bufferHash.length}`);
        return false;
    }

    const valid = crypto.timingSafeEqual(bufferHeader, bufferHash);
    if (!valid) {
        console.log('❌ HMAC verification failed. Invalid signature.');
    } else {
        console.log('✅ HMAC verified successfully.');
    }
    return valid;
}


async function delay(ms) {
    console.log(`⏳ Delaying processing for ${ms} ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function addTagIfNeeded(order, shop, accessToken) {
    try {
        console.log(`🔍 Checking order ${order.id} for SKU ${PRODUCT_SKU_TO_CHECK}`);

        const hasSku = order.line_items?.some(item => item.sku === PRODUCT_SKU_TO_CHECK);
        if (!hasSku) {
            console.log(`❌ SKU ${PRODUCT_SKU_TO_CHECK} not found in order ${order.id}. No tag added.`);
            return;
        }

        const currentTags = order.tags?.split(',').map(t => t.trim()) || [];
        console.log(`📝 Current tags for order ${order.id}: [${currentTags.join(', ')}]`);

        if (currentTags.includes(TAG_TO_ADD)) {
            console.log(`ℹ️ Tag "${TAG_TO_ADD}" already present on order ${order.id}. Skipping tag addition.`);
            return;
        }

        console.log(`➕ Adding tag "${TAG_TO_ADD}" to order ${order.id}`);

        const newTags = [...currentTags, TAG_TO_ADD];
        const url = `https://${shop}/admin/api/2025-07/orders/${order.id}.json`;
        console.log(`🔗 Sending PUT request to Shopify API: ${url}`);

        const response = await axios.put(url, {
            order: { id: order.id, tags: newTags.join(', ') }
        }, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Tag added successfully for order ${order.id}. Shopify response status: ${response.status}`);

    } catch (error) {
        console.error(`❌ Error adding tag for order ${order.id}:`, error.response?.data || error.message || error);
    }
}

export default async function handler(req, res) {
    try {
        console.log('🔥 Webhook handler called');

        if (req.method !== 'POST') {
            console.log(`⚠️ Method not allowed: ${req.method}`);
            return res.status(405).end('Method Not Allowed');
        } else {
            console.log(` Method allowed: ${req.method}`);

            console.log('📥 Receiving raw request body...');
            // Use req.body directly - it's already a Buffer from express.raw()
            const body = req.body;
            console.log('📥 Raw webhook body received');

            const { SHOPIFY_SHARED_SECRET, SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP } = process.env;
            console.log('🛠️ Env vars loaded:', {
                SHOPIFY_SHARED_SECRET: !!SHOPIFY_SHARED_SECRET,
                SHOPIFY_ACCESS_TOKEN: !!SHOPIFY_ACCESS_TOKEN,
                SHOPIFY_SHOP
            });

            if (process.env.SKIP_HMAC_CHECK === 'true') {
                console.log('⚠️ Skipping HMAC check for testing');
            } else if (!verifyHmac(req, body, SHOPIFY_SHARED_SECRET)) {
                console.log('❌ Unauthorized webhook call due to invalid HMAC.');
                return res.status(401).send('Unauthorized');
            }

            console.log('🚀 Webhook verified and processing order update');

            let order;
            try {
                order = JSON.parse(body.toString('utf8'));
                console.log(`🆔 Order parsed successfully: ID ${order.id}`);
            } catch (err) {
                console.error('❌ Failed to parse JSON body:', err);
                return res.status(400).send('Invalid JSON');
            }

            await delay(DELAY_MINUTES_ON_CREATE * 60 * 1000);
            await addTagIfNeeded(order, SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN);

            console.log(`✅ Order ${order.id} processing complete.`);
            res.status(200).send('OK');
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err);
        res.status(500).send('Internal Server Error');
    }
}
