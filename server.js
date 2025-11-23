// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Telegraf, session } from 'telegraf';
import { initRouter } from './src/bot/router.js';

import { 
  initMiddleware, 
  performanceMiddleware, 
  antiSpamMiddleware, 
  checkAccessMiddleware, 
  errorMiddleware,
} from './src/bot/middleware.js';
import { testConnection, validateTables } from './src/config/database.js';
import { initScheduler, stopScheduler } from './src/services/scheduler.js';
import { clearAllUserCache } from './src/services/users.js';
import subscriptionWebhook from './src/core/subscription/webhook.js';
import { handleAirtableWebhook } from './src/webhooks/airtable.js';
import { handleTildaFormWebhook } from './src/tilda/webhooks.js';

const { TELEGRAM_BOT_TOKEN, NODE_ENV, PORT = 3000 } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній');
  process.exit(1);
}

// Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhooks
app.post('/webhooks/airtable', handleAirtableWebhook);
app.post('/webhook/tilda/form', handleTildaFormWebhook);
app.post('/api/wayforpay/webhook', subscriptionWebhook);

// Health & Admin
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    env: process.env.NODE_ENV 
  });
});

app.get('/admin/clear-cache', (req, res) => {
  try {
    const cleared = clearAllUserCache();
    res.json({ cleared });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot
const bot = new Telegraf(TELEGRAM_BOT_TOKEN, { handlerTimeout: 15_000 });

bot.use(session({ defaultSession: () => ({ wheel: null, registration: null, ai: null }) }));
bot.use(errorMiddleware);
bot.use(antiSpamMiddleware());
bot.use(initMiddleware());
bot.use(checkAccessMiddleware());
bot.use(performanceMiddleware(2000));

bot.catch((err, ctx) => {
  console.error('❌ Error:', err.message, 'User:', ctx.from?.id);
  ctx.reply('❌ Помилка. Спробуй /start').catch(() => {});
});

// Startup
(async () => {
  try {
    const db = await testConnection();
    if (!db?.success) throw new Error('Airtable недоступний');
    
    await validateTables();
    initRouter(bot);
    initScheduler(bot);
    
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
    
    app.listen(PORT, () => {
      console.log(`✅ Bot: @${bot.botInfo.username}`);
      console.log(`✅ Server: http://localhost:${PORT}`);
      console.log(`🌐 Tilda Webhook: http://localhost:${PORT}/webhook/tilda/form`);
    });
  } catch (e) {
    console.error('❌ Startup:', e.message);
    process.exit(1);
  }
})();

// Shutdown
const shutdown = (signal) => async () => {
  console.log(`🛑 ${signal}`);
  stopScheduler();
  await bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', shutdown('SIGINT'));
process.once('SIGTERM', shutdown('SIGTERM'));