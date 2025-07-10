require('dotenv').config();
const express = require('express');
const ordersUpdate = require('./api/orders-update');

const app = express();
const port = process.env.PORT || 3002;

app.post('/webhooks/orders-update', express.raw({ type: 'application/json' }), ordersUpdate);

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
