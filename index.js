import dotenv from 'dotenv';
import express from 'express';

dotenv.config();


const ordersUpdate = require('./api/orders-update');

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json()); // parse JSON bodies automatically

app.post('/webhooks/orders-update', express.json(), (req, res) => {
    ordersUpdate.handler(req, res);
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
