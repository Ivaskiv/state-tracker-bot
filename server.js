// server.js — ВИПРАВЛЕНА ВЕРСІЯ З РОЗШИРЕНИМ MIDDLEWARE

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Telegraf, session } from 'telegraf';
import { initRouter } from './src/bot/router.js';

// ✅ ІМПОРТ ВСІХ MIDDLEWARE
import { 
  initMiddleware, 
  performanceMiddleware, 
  antiSpamMiddleware 
} from './src/bot/middleware.js';

// Config
import { testConnection, validateTables } from './src/config/database.js';

// Services
import { startScheduler, stopScheduler } from './src/services/scheduler.js';

// Webhook
import subscriptionWebhook from './src/features/subscription/webhook.js';

const { TELEGRAM_BOT_TOKEN, NODE_ENV, TZ, PORT } = process.env;

// ===== ПЕРЕВІРКА ENV =====
if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній у .env');
  process.exit(1);
}

console.log('🚀 [server] Запуск бота...');
console.log(`🟢 MODE=${NODE_ENV || 'development'} | TZ=${TZ || 'Europe/Kiev'}`);

// ===== EXPRESS SERVER ДЛЯ WEBHOOK =====
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint
app.post('/api/wayforpay/webhook', subscriptionWebhook);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT_NUMBER = parseInt(PORT || '3000', 10);

// ===== ІНІЦІАЛІЗАЦІЯ БОТА =====
const bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 15_000,
});

// ===== MIDDLEWARE STACK (ПОРЯДОК ВАЖЛИВИЙ!) =====

// 1️⃣ Session - завжди першим
bot.use(session({ 
  defaultSession: () => ({
    wheel: null,
    onboarding: null,
    ai: null
  }) 
}));

// 2️⃣ Anti-spam protection (опціонально - розкоментуй для production)
bot.use(antiSpamMiddleware());

// 3️⃣ Performance logging (опціонально - для моніторингу повільних запитів)
// bot.use(performanceMiddleware());

// 4️⃣ Main middleware - логування + typing + error handling
bot.use(initMiddleware());

// ===== ГЛОБАЛЬНИЙ ERROR HANDLER =====
bot.catch((err, ctx) => {
  console.error('❌ [bot] Unhandled error:', {
    error: err.message,
    stack: err.stack?.split('\n')[0],
    user: ctx.from?.id,
    update: ctx.updateType
  });
  
  try {
    ctx.reply?.('❌ Виникла помилка. Спробуй ще раз або використай /start', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Спробувати знову', callback_data: 'main_menu' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
        ]
      }
    }).catch(() => {});
  } catch (replyError) {
    console.error('❌ [bot] Помилка відправки error message:', replyError.message);
  }
});

// ===== ЗАПУСК =====
(async () => {
  try {
    console.log('🔧 [server] Ініціалізація системи...');
    
    // 1️⃣ ТЕСТ ПІДКЛЮЧЕННЯ ДО AIRTABLE
    console.log('📊 [server] Перевірка підключення до Airtable...');
    const db = await testConnection();
    
    if (!db?.success) {
      console.error('❌ [server] Airtable недоступний:', db?.error);
      console.error('💡 [server] Перевір AIRTABLE_API_KEY та AIRTABLE_BASE_ID в .env');
      process.exit(1);
    }
    
    console.log('✅ [server] Airtable підключено успішно');
    
    // 2️⃣ ВАЛІДАЦІЯ КРИТИЧНИХ ТАБЛИЦЬ
    console.log('🔍 [server] Валідація таблиць...');
    const validation = await validateTables();
    
    if (!validation.valid) {
      console.warn('⚠️ [server] Деякі таблиці недоступні:');
      validation.results
        .filter(r => r.status === '❌')
        .forEach(r => console.warn(`   ❌ ${r.table}: ${r.error}`));
      console.warn('💡 [server] Бот продовжить роботу, але функціонал може бути обмежений');
    } else {
      console.log('✅ [server] Всі критичні таблиці доступні');
    }
    
    // 3️⃣ ІНІЦІАЛІЗАЦІЯ РОУТЕРА
    console.log('🎮 [server] Ініціалізація роутера...');
    initRouter(bot);
    console.log('✅ [server] Роутер готовий');
    
    // 4️⃣ ЗАПУСК SCHEDULER
    console.log('⏰ [server] Запуск планувальника...');
    try {
      startScheduler(bot);
      console.log('✅ [server] Планувальник активовано');
    } catch (schedulerError) {
      console.warn('⚠️ [server] Помилка запуску планувальника:', schedulerError.message);
      console.warn('💡 [server] Бот працюватиме без автоматичних нагадувань');
    }
    
    // 5️⃣ ОЧИЩЕННЯ WEBHOOK
    console.log('🧹 [server] Очищення webhook...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    // 6️⃣ ЗАПУСК LONG POLLING
    console.log('🚀 [server] Запуск long polling...');
    await bot.launch({
      allowedUpdates: ['message', 'callback_query'],
    });
    
    // 7️⃣ ЗАПУСК EXPRESS SERVER
    app.listen(PORT_NUMBER, () => {
      console.log(`🌐 [server] Express server запущено на порту ${PORT_NUMBER}`);
      console.log(`🔗 [server] Webhook URL: http://localhost:${PORT_NUMBER}/api/wayforpay/webhook`);
    });
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('✅ БОТ УСПІШНО ЗАПУЩЕНО');
    console.log('═══════════════════════════════════════');
    console.log(`📱 Режим: ${NODE_ENV || 'development'}`);
    console.log(`🌍 Часова зона: ${TZ || 'Europe/Kiev'}`);
    console.log(`🤖 Bot ID: @${(await bot.telegram.getMe()).username}`);
    console.log(`🌐 Webhook port: ${PORT_NUMBER}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════');
    console.error('❌ КРИТИЧНА ПОМИЛКА ЗАПУСКУ');
    console.error('═══════════════════════════════════════');
    console.error('Помилка:', error.message);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════');
    console.error('');
    process.exit(1);
  }
})();

// ===== GRACEFUL SHUTDOWN =====
const shutdown = (signal) => async () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`🛑 ${signal} отримано - зупинка бота...`);
  console.log('═══════════════════════════════════════');
  
  try {
    console.log('⏰ [shutdown] Зупинка планувальника...');
    try {
      stopScheduler();
      console.log('✅ [shutdown] Планувальник зупинено');
    } catch (schedulerError) {
      console.warn('⚠️ [shutdown] Помилка зупинки планувальника:', schedulerError.message);
    }
    
    console.log('🤖 [shutdown] Зупинка бота...');
    await bot.stop(signal);
    console.log('✅ [shutdown] Бот зупинено');
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('👋 Зупинено чисто');
    console.log('═══════════════════════════════════════');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════');
    console.error('❌ ПОМИЛКА ПРИ ЗУПИНЦІ');
    console.error('═══════════════════════════════════════');
    console.error('Помилка:', error.message);
    console.error('═══════════════════════════════════════');
    console.error('');
    process.exit(1);
  }
};

process.once('SIGINT', shutdown('SIGINT'));
process.once('SIGTERM', shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('🔴 [process] Unhandled Rejection:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('Stack:', reason?.stack);
  console.error('');
});

process.on('uncaughtException', (error) => {
  console.error('');
  console.error('🔴 [process] Uncaught Exception:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('');
  
  if (error.code === 'EADDRINUSE' || error.code === 'ECONNREFUSED') {
    console.error('💀 [process] Критична помилка - завершення процесу');
    process.exit(1);
  }
});

process.on('warning', (warning) => {
  console.warn('⚠️ [process] Warning:', warning.name);
  console.warn('Message:', warning.message);
  if (warning.stack) {
    console.warn('Stack:', warning.stack);
  }
});

console.log('📋 [process] Node.js версія:', process.version);
console.log('💾 [process] Пам\'ять:', {
  heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
});
console.log('🔧 [process] PID:', process.pid);
console.log('');