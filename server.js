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
  checkUserRegistration, 
  errorMiddleware
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

// ═══════════════════════════════════════════════════════════
// EXPRESS
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// TELEGRAF BOT
// ═══════════════════════════════════════════════════════════

const bot = new Telegraf(TELEGRAM_BOT_TOKEN, { handlerTimeout: 15_000 });

// ───────────────────────────────────────────────────────────
// MIDDLEWARE (порядок критично важливий!)
// ───────────────────────────────────────────────────────────

// 1. Session (має бути першим)
bot.use(session({ 
  defaultSession: () => ({ 
    wheel: null, 
    registration: null, 
    ai: null 
  }) 
}));

// 2. Error handling
bot.use(errorMiddleware);

// 3. Anti-spam (захист від флуду)
bot.use(antiSpamMiddleware());

// 4. Init middleware (завантажує базові дані користувача)
bot.use(initMiddleware());

// 5. ✨ Централізована перевірка реєстрації
bot.use(checkUserRegistration);

// 6. Performance tracking
bot.use(performanceMiddleware(2000));

// Global error handler
bot.catch((err, ctx) => {
  console.error('❌ Global Error:', err.message, 'User:', ctx.from?.id);
  ctx.reply('❌ Виникла помилка. Спробуй /start').catch(() => {});
});

// ═══════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════

(async () => {
  try {
    console.log('🚀 [Startup] Перевірка бази даних...');
    const db = await testConnection();
    if (!db?.success) throw new Error('Airtable недоступний');
    
    console.log('🚀 [Startup] Валідація таблиць...');
    await validateTables();
    
    console.log('🚀 [Startup] Ініціалізація роутера...');
    initRouter(bot);
    
    console.log('🚀 [Startup] Ініціалізація scheduler...');
    initScheduler(bot);
    
    console.log('🚀 [Startup] Запуск бота...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
    
    console.log('🚀 [Startup] Запуск Express сервера...');
    app.listen(PORT, () => {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`✅ Bot: @${bot.botInfo.username}`);
      console.log(`✅ Server: http://localhost:${PORT}`);
      console.log(`✅ Health: http://localhost:${PORT}/health`);
      console.log(`🌐 Tilda Webhook: http://localhost:${PORT}/webhook/tilda/form`);
      console.log(`🌐 Airtable Webhook: http://localhost:${PORT}/webhooks/airtable`);
      console.log(`💳 Payment Webhook: http://localhost:${PORT}/api/wayforpay/webhook`);
      console.log('═══════════════════════════════════════════════════════');
    });
  } catch (e) {
    console.error('❌ Startup Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();

// ═══════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════

const shutdown = (signal) => async () => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    stopScheduler();
    await bot.stop(signal);
    console.log('✅ Bot stopped');
    process.exit(0);
  } catch (err) {
    console.error('❌ Shutdown error:', err);
    process.exit(1);
  }
};

process.once('SIGINT', shutdown('SIGINT'));
process.once('SIGTERM', shutdown('SIGTERM'));

// Unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});