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
  activityMiddleware
 } from './src/bot/middleware.js';
import { testConnection, validateTables } from './src/config/database.js';
import { initScheduler, stopScheduler } from './src/services/scheduler.js';
import { clearAllUserCache } from './src/services/users.js';
import subscriptionWebhook from './src/core/subscription/webhook.js';
import { handleAirtableWebhook } from './src/webhooks/airtable.js';

const { TELEGRAM_BOT_TOKEN, NODE_ENV, PORT = 3000 } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній');
  process.exit(1);
}

// Express
const app = express();
app.use(express.json());
app.post('/webhooks/airtable', handleAirtableWebhook);
app.post('/api/wayforpay/webhook', subscriptionWebhook);
app.get('/health', (req, res) => res.json({ ok: true }));
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
bot.use(errorMiddleware);           // 1️⃣ Ловимо помилки
bot.use(antiSpamMiddleware());      // 2️⃣ Захист від спаму
bot.use(initMiddleware());          // 3️⃣ Auth + State (автоматично)
bot.use(activityMiddleware);        // 4️⃣ Оновлення активності
bot.use(checkAccessMiddleware());   // 5️⃣ Перевірка підписки
bot.use(performanceMiddleware(2000)); // 6️⃣ Моніторинг швидкості

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