import express from 'express';
import ordersCreateHandler from './webhooks/ordersCreate.js';

const app = express();
app.use(express.json({ type: 'application/json' }));

app.post('/webhooks/orders-create', ordersCreateHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook server running on port ${PORT}`));
