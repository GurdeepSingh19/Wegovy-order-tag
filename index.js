import dotenv from 'dotenv';
import express from 'express';
import ordersUpdate from './api/orders-update.js'; // note the `.js` extension

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.post('/webhooks/orders-update', express.raw({ type: 'application/json' }), ordersUpdate);

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
