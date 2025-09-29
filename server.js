// server.js — МІНІМАЛЬНИЙ ЗАПУСК (стабільний)
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, session } from 'telegraf';
import botController from './src/controllers/botController.js';
import { testConnection } from './src/config/database.js';

const { TELEGRAM_BOT_TOKEN, NODE_ENV, TZ } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній у .env');
  process.exit(1);
}

console.log(`🟢 MODE=${NODE_ENV || 'development'} | TZ=${TZ || 'UTC'}`);

const bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 15_000,
});

// Session для тимчасових даних
bot.use(session({ defaultSession: () => ({}) }));

// Глобальний error guard
bot.catch((err, ctx) => {
  console.error('❌ [bot] Unhandled error:', err);
  try { ctx.reply?.('Сталася помилка. Спробуй ще раз.'); } catch {}
});

// Ініціалізація контролерів
botController(bot);

// Запуск
(async () => {
  try {
    // 1) Разовий healthcheck БД (не створює дубль-конекшенів)
    const db = await testConnection();
    if (!db?.success) {
      console.warn('⚠️ Airtable не пройшов перевірку:', db?.error);
    }

    // 2) Прибираємо webhook для polling
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    // 3) Запускаємо long polling
    await bot.launch({
      allowedUpdates: ['message', 'callback_query'],
    });

    console.log('✅ Бот запущено (long polling)');
  } catch (error) {
    console.error('❌ Помилка запуску:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
const shutdown = (signal) => async () => {
  console.log(`🛑 ${signal} отримано. Зупиняю бота…`);
  try {
    await bot.stop(signal);
    console.log('👋 Зупинено чисто.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Помилка при зупинці:', e);
    process.exit(1);
  }
};

process.once('SIGINT', shutdown('SIGINT'));
process.once('SIGTERM', shutdown('SIGTERM'));

// Безпека процеса
process.on('unhandledRejection', (r) => console.error('🔴 UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('🔴 UncaughtException:', e));
