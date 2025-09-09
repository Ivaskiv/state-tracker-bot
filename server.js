// import express from 'express';                    // [SERVER DISABLED]
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import botController from './src/controllers/botController.js';
// import { handleWayForPayWebhook } from './src/auth/services/paymentService.js'; // [SERVER DISABLED]
import { initScheduler } from './src/dialogue/utils/scheduler.js';
import { installPendingFlow } from './src/middleware/pendingFlow.js'; // ⬅️ виправлено імпорт

dotenv.config();

// const app = express();                            // [SERVER DISABLED]
const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'local';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// const WEBHOOK_URL = process.env.WEBHOOK_URL;      // [SERVER DISABLED]

// Валідаціaя середовища
console.log('🔍 Environment check:');
console.log('- MODE:', MODE);
console.log('- PORT:', PORT);
console.log('- TOKEN:', TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING');
// console.log('- WEBHOOK_URL:', WEBHOOK_URL || 'NOT SET'); // [SERVER DISABLED]

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing');
  console.error('Set TELEGRAM_BOT_TOKEN in your environment variables (.env).');
  process.exit(1);
}

// Створюємо нового бота (без синглтона)
console.log('🤖 Initializing bot...');
const bot = new Telegraf(TOKEN);
console.log('✅ New bot instance created');

// Обробка помилок бота
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  console.error('- Update:', ctx?.update);
  if (err.code === 409 && err.description?.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict detected: Another bot instance is running. Please ensure only one instance is active.');
  }
});

// ===== [SERVER DISABLED] Express + маршрути відключено =====
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Webhook для WayForPay
// app.post('/wayforpay-webhook', async (req, res) => {
//   try {
//     await handleWayForPayWebhook(req.body);
//     res.status(200).send('OK');
//   } catch (error) {
//     console.error('❌ WayForPay webhook error:', error);
//     res.status(500).send('Error');
//   }
// });

// // Кореневий маршрут
// app.get('/', (_req, res) => res.send('Bot is running!'));

// // Health check ендпоінт
// app.get('/health', async (_req, res) => {
//   try {
//     const me = await bot.telegram.getMe();
//     res.json({
//       status: 'ok',
//       bot: me,
//       mode: MODE,
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error('❌ Health check failed:', error);
//     res.status(500).json({
//       status: 'error',
//       error: error.message,
//       mode: MODE,
//     });
//   }
// });
// ===== [SERVER DISABLED] =====

// Ініціалізація контролерів
console.log('🎮 Loading bot controller...');
try {
  botController(bot);
  console.log('✅ Bot controller loaded');
} catch (error) {
  console.error('❌ Error loading bot controller:', error);
  process.exit(1);
}

// ⬇️ Мідлвара: блокує меню під час незавершених відповідей + команди продовжити/завершити
installPendingFlow(bot); // ⬅️ виправлено виклик

// Ініціалізація планувальника
console.log('⏰ Initializing scheduler...');
try {
  initScheduler(bot);
  console.log('✅ Scheduler initialized');
} catch (error) {
  console.error('❌ Error initializing scheduler:', error);
  process.exit(1);
}

// ===== Локальний запуск через polling (без сервера) =====
(async () => {
  console.log(`💻 Local launch without Express server (PORT=${PORT}, MODE=${MODE})`);
  console.log('🔧 Setting up LOCAL mode (polling)...');

  // Очищення вебхука та попередніх оновлень
  console.log('🗑️ Clearing webhook and pending updates...');
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook cleared');
  } catch (error) {
    console.error('❌ Failed to clear webhook:', error);
  }

  // Невеличка затримка
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Запуск polling
  console.log('🔄 Starting polling...');
  try {
    await bot.launch({
      polling: {
        timeout: 30,
        limit: 100,
        allowed_updates: ['message', 'callback_query'],
      },
    });
    console.log('✅ Polling started (LOCAL)');
  } catch (error) {
    console.error('❌ STARTUP ERROR (polling):', error);
    process.exit(1);
  }

  // Перевірка з'єднання з Telegram
  console.log('🔍 Testing connection to Telegram...');
  try {
    const me = await bot.telegram.getMe();
    console.log(`✅ Connected to Telegram as @${me.username} (${me.first_name})`);
  } catch (error) {
    console.error('❌ Failed to get bot info:', error);
  }
})();

// Утиліта для typing анімації
const sendTyping = async (ctx, delay = 800) => {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
  } catch {}
  try {
    await new Promise(resolve => setTimeout(resolve, delay));
  } catch {}
};

// Грейсфул-стоп
const gracefulShutdown = async (signal) => {
  console.log(`🛑 Received ${signal}, stopping bot...`);
  try {
    await bot.stop(signal);
    console.log('✅ Bot stopped successfully');
  } catch (error) {
    console.error('❌ Error stopping bot:', error);
  }
  process.exit(0);
};

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { bot }; 