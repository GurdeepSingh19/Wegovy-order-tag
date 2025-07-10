import dotenv from 'dotenv';
import express from 'express';
import ordersUpdate from './api/orders-update.js'; // note the `.js` extension

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json()); // parse JSON bodies automatically

app.post('/webhooks/orders-update', (req, res) => {
    ordersUpdate.handler(req, res);
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
