import 'dotenv/config';
import express from 'express';
import ordersUpdate from './api/orders-update.js';

const app = express();
const port = process.env.PORT || 3002;

app.post('/webhooks/orders-update', express.raw({ type: 'application/json' }), ordersUpdate);

app.listen(port, () => {
    console.log(`🚀 NEW Server running on port ${port}`);
});
