import express from 'express';
import bodyParser from 'body-parser';
import { handleWayforpayCallback } from './controllers/payment.js';
import { Telegraf } from 'telegraf';
import { config } from './config/config.js';

const app = express();
app.use(bodyParser.json());

app.post('/wayforpay-callback', async (req, res) => {
  const data = req.body;

  if (data.transactionStatus === 'Approved') {
    const tgId = data.customFields.tg_id; // передаємо tg_id як customField
    const orderReference = data.orderReference;

    await handleWayforpayCallback({ tgId, orderReference });

    // Надсилаємо користувачу повідомлення через бота
    const bot = new Telegraf(config.botToken);
    await bot.telegram.sendMessage(
      tgId,
      `✅ Оплата успішна! Твій план активовано. Використовуй /morning або /evening для сесій.`
    );
  }

  res.json({ status: 'ok' });
});

app.listen(3000, () => console.log('Webhook WayforPay запущено на 3000'));
