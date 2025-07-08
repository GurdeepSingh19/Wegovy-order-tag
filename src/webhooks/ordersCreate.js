import crypto from 'crypto';
import axios from 'axios';

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const PRODUCT_SKU_TO_CHECK = '9000000';
const TAG_TO_ADD = 'prescription-required';
const DELAY_MINUTES = 5;

function verifyShopifyWebhook(req) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const digest = crypto
    .createHmac('sha256', SHOPIFY_SHARED_SECRET)
    .update(JSON.stringify(req.body), 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hmac, 'base64'), Buffer.from(digest, 'base64'));
}

export default async function ordersCreateHandler(req, res) {
  if (!verifyShopifyWebhook(req)) {
    console.warn('Webhook signature verification failed.');
    return res.status(401).send('Unauthorized');
  }

  const order = req.body;
  res.status(200).send('Webhook received');

  try {
    const hasProduct = order.line_items.some(item => item.sku === PRODUCT_SKU_TO_CHECK);
    if (!hasProduct) return;

    await new Promise(resolve => setTimeout(resolve, DELAY_MINUTES * 60 * 1000));

    const existingTags = order.tags ? order.tags.split(',').map(t => t.trim()) : [];
    if (!existingTags.includes(TAG_TO_ADD)) existingTags.push(TAG_TO_ADD);

    await axios.put(
      `https://${SHOPIFY_SHOP}/admin/api/2023-04/orders/${order.id}.json`,
      { order: { id: order.id, tags: existingTags.join(', ') } },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Order ${order.id} tagged successfully.`);
  } catch (error) {
    console.error('Error tagging order:', error.response?.data || error.message);
  }
}
