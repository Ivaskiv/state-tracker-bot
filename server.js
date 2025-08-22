// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { bot } from './src/controllers/botController.js';
import { initScheduler } from './src/utils/scheduler.js';

const app = express();
app.use(express.json());

// health-check
app.get('/', (_, res) => res.send('OK ✅'));

// (опційно) вебхук WayForPay можна додати тут пізніше

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`🌐 Server listening on :${port}`);
  await bot.launch();
  initScheduler(bot);
  console.log('🤖 Telegram bot launched');
});

/* Webhook поки закоментовано
const useWebhook = process.env.USE_WEBHOOK === 'true';
if (useWebhook) {
  const express = require('express');
  const bodyParser = require('body-parser');
  const app = express();
  app.use(bodyParser.json());

  const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
  bot.telegram.setWebhook(`${process.env.APP_URL}${webhookPath}`);
  app.post(webhookPath, (req, res) => bot.handleUpdate(req.body, res));

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 Server running with webhook on port ${port}`));
}
*/
