// server.js - ВИПРАВЛЕНО: правильна ініціалізація

import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';
import path from 'path';

// Завантажуємо змінні оточення ПЕРШИМ
dotenv.config();

// Перевіряємо критичні змінні
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній в .env');
  process.exit(1);
}

console.log('🔍 [DEBUG] Змінні оточення готові');

// Імпортуємо модулі ПІСЛЯ налаштування env
import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import paymentService from './src/auth/services/paymentService.js';
import { startScheduler } from './src/utils/scheduler.js';
import { SCHEDULE } from './src/config/constants.js';

// Налаштування
const PORT = Number(process.env.PORT || 3000);
const MODE = process.env.NODE_ENV === 'development' ? 'local' : 'webhook';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE = process.env.WEBHOOK_URL || '';

// Встановлюємо часовий пояс
process.env.TZ = process.env.TZ || SCHEDULE.TIMEZONE;

// Створюємо та налаштовуємо бота
const bot = new Telegraf(TOKEN);

// Ініціалізуємо session middleware
bot.use(session({
  defaultSession: () => ({ 
    step: undefined, 
    temp: {},
    wheel: null,
    ai: null 
  })
}));

// Глобальна обробка помилок
bot.catch((err, ctx) => {
  console.error('❌ Telegraf error:', err);
});

// Підключаємо контролери бота
try {
  botController(bot);
  console.log('✅ Bot handlers встановлено');
} catch (e) {
  console.error('❌ Помилка встановлення bot handlers:', e);
  process.exit(1);
}

// Express сервер
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/static', express.static(path.join(process.cwd(), 'public')));

// Health endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bot: 'running',
    tz: process.env.TZ,
    mode: MODE
  });
});

// WayForPay webhook endpoint
app.post('/api/wayforpay/webhook', async (req, res) => {
  try {
    console.log('[W4P] 🔔 Webhook отримано');
    const processed = wayforpayService.processWebhookData(req.body);
    const result = await paymentService.handleWayForPayWebhook(processed);
    const response = wayforpayService.generateWebhookResponse('accept');
    console.log('[W4P] ✅ Webhook оброблено');
    res.json(response);
  } catch (error) {
    console.error('[W4P] ❌ Помилка webhook:', error);
    const response = wayforpayService.generateWebhookResponse('decline');
    res.status(400).json(response);
  }
});

// Запуск бота та сервера
const startBot = async () => {
  if (MODE === 'local') {
    console.log(`💻 Local mode: polling`);
    
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log('🧹 Webhook cleared');
    } catch (e) {
      console.warn('ℹ️ deleteWebhook warn:', e?.message);
    }
    
    await bot.launch({
      allowedUpdates: ['message', 'callback_query'],
      dropPendingUpdates: true
    });
    console.log('🤖 Bot polling запущено');
    
    app.listen(PORT, () => {
      console.log(`🌐 HTTP server: http://localhost:${PORT}`);
    });
    
  } else {
    const webhookPath = `/webhook/${TOKEN}`;
    const webhookUrl = `${WEBHOOK_BASE}${webhookPath}`;
    
    app.use(webhookPath, bot.webhookCallback(webhookPath));
    
    app.listen(PORT, async () => {
      console.log(`🚀 Production server на порт ${PORT}`);
      
      try {
        await bot.telegram.setWebhook(webhookUrl, {
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true
        });
        console.log(`✅ Webhook встановлено: ${webhookUrl}`);
      } catch (e) {
        console.error('❌ setWebhook error:', e);
        process.exit(1);
      }
    });
  }
  
  // Запускаємо scheduler
  setTimeout(async () => {
    try {
      await startScheduler(bot);
      console.log('⏱️ Scheduler запущено');
    } catch (e) {
      console.error('❌ Scheduler помилка:', e);
    }
  }, 3000);
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`🛑 ${signal}: зупинка...`);
  try {
    await bot.stop(signal);
    console.log('✅ Bot зупинено');
  } catch (e) {
    console.error('❌ stop error:', e);
  } finally {
    process.exit(0);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Запуск
startBot().catch(error => {
  console.error('❌ Критична помилка запуску:', error);
  process.exit(1);
});

// Експортуємо для інших модулів
export { bot };