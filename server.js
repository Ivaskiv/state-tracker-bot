//server.js
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import botController from './src/controllers/botController.js';
import { initScheduler } from './src/dialogue/utils/scheduler.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';

const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Підключаємо контролер
botController(bot);

// Ініціалізуємо CRON
initScheduler(bot);

// WayForPay webhook
app.post('/wayforpay-webhook', async (req, res) => {
  try {
    await handleWayForPayWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('WayForPay webhook error:', error);
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => res.send('Bot is running!'));

app.listen(PORT, async () => {
  console.log(`💻 Express app listening on port ${PORT}`);

  const mode = process.env.MODE || 'local';
  if (mode === 'local') {
    console.log('⚙️ Running in MODE: local');
    await bot.launch({ polling: true });
  } else {
    console.log('⚙️ Running in MODE: production');
    await bot.launch({
      webhook: {
        domain: process.env.WEBHOOK_URL,
        port: PORT,
        hookPath: `/webhook/${process.env.BOT_TOKEN}`,
      },
    });
  }

  console.log('🌐 Bot launched');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export { bot };