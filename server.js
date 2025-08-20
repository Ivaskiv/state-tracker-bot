// server.js
import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';

import botController from './src/controllers/botController.js';
import schedulerService from './src/services/schedulerService.js';
import errorHandler from './src/middleware/errorHandler.js'; // якщо немає — створиш пустий, або прибери рядок

import './src/config/airtable.js';

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// HTTP middleware
app.use(express.json());
if (errorHandler) app.use(errorHandler);

// Bot session
bot.use(session({
  defaultSession: () => ({
    step: null,
    temp: {},
  })
}));

// Init bot handlers
botController(bot);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    timezone: 'Europe/Kyiv'
  });
});

// Webhook (опціонально)
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Payment webhook (плейсхолдер)
app.post('/payment-webhook', (req, res) => {
  console.log('Payment webhook:', req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
      await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
      console.log('✅ Webhook set successfully');
    } else {
      await bot.launch();
      console.log('✅ Bot started in polling mode');
    }
    await schedulerService(bot);
    console.log('✅ Scheduler initialized');
  } catch (e) {
    console.error('❌ Error starting bot:', e);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
