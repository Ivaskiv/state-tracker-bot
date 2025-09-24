// server.js - ВИПРАВЛЕНО: правильна ініціалізація та порядок запуску

import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';
import path from 'path';

// Завантажуємо змінні оточення ПЕРЕД усім іншим
dotenv.config();

// Перевіряємо критичні змінні
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній в .env');
  process.exit(1);
}

console.log('🔍 [DEBUG] Змінні оточення:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET');
console.log('- AIRTABLE_API_KEY:', process.env.AIRTABLE_API_KEY ? 'SET' : 'NOT SET');

// Імпортуємо модулі ПІСЛЯ налаштування env
import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';
import { startScheduler } from './src/utils/scheduler.js';
import { SCHEDULE } from './src/config/constants.js';

// Налаштування
const PORT = Number(process.env.PORT || 3000);
const MODE = process.env.NODE_ENV === 'development' ? 'local' : 'webhook';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE = process.env.WEBHOOK_URL || '';

console.log('🔍 Конфігурація:', {
  MODE, PORT, TZ: process.env.TZ, NODE_ENV: process.env.NODE_ENV,
  TOKEN: TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING'
});

// Встановлюємо часовий пояс
process.env.TZ = process.env.TZ || SCHEDULE.TIMEZONE;

// ——— 1) Створюємо та налаштовуємо бота
const bot = new Telegraf(TOKEN);

// ВАЖЛИВО: ініціалізуємо session middleware ПЕРШИМ
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
  const msg = `${err?.message || ''} ${err?.description || ''}`;
  if (msg.includes('409') || msg.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict: інша інстанція вже тягне getUpdates. Зупини її.');
    return;
  }
  console.error('❌ Telegraf error:', err);
});

// ——— 2) Підключаємо контролери бота
try {
  botController(bot);
  console.log('✅ Bot handlers встановлено');
} catch (e) {
  console.error('❌ Помилка встановлення bot handlers:', e);
  process.exit(1);
}

// ——— 3) Express сервер
const app = express();

// Middleware для парсингу JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статичні файли
app.use('/static', express.static(path.join(process.cwd(), 'public')));

// Health endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bot: 'running',
    tz: process.env.TZ,
    mode: MODE,
    env: process.env.NODE_ENV,
    webhook_url: WEBHOOK_BASE ? `${WEBHOOK_BASE}/webhook/${TOKEN}` : 'not configured'
  });
});

// WayForPay webhook endpoint
app.post('/api/wayforpay/webhook', async (req, res) => {
  try {
    console.log('[W4P] 🔔 Webhook отримано:', JSON.stringify(req.body, null, 2));
    
    const processed = wayforpayService.processWebhookData(req.body);
    const result = await handleWayForPayWebhook(processed);
    const response = wayforpayService.generateWebhookResponse('accept');
    
    console.log('[W4P] ✅ Webhook оброблено:', result);
    res.json(response);
  } catch (error) {
    console.error('[W4P] ❌ Помилка webhook:', error);
    const response = wayforpayService.generateWebhookResponse('decline');
    res.status(400).json(response);
  }
});

// Dev endpoints
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/test-message', async (req, res) => {
    const { tgId, message } = req.body;
    if (!tgId || !message) {
      return res.status(400).json({ error: 'tgId and message required' });
    }
    
    try {
      await bot.telegram.sendMessage(tgId, message);
      res.json({ status: 'sent', tgId, message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('🛠️ Dev endpoints готові: /dev/test-message');
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: `${req.method} ${req.path}`,
    available: [
      'GET /health',
      'POST /api/wayforpay/webhook',
      ...(process.env.NODE_ENV === 'development' ? ['POST /dev/test-message'] : [])
    ]
  });
});

// ——— 4) Запуск бота та сервера
const startBot = async () => {
  if (MODE === 'local') {
    console.log(`💻 Local mode: polling + Express (PORT=${PORT})`);
    
    try {
      // Очищуємо webhook
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log('🧹 Webhook cleared');
    } catch (e) {
      console.warn('ℹ️ deleteWebhook warn:', e?.message);
    }
    
    // Запускаємо polling
    await bot.launch({
      allowedUpdates: ['message', 'callback_query'],
      dropPendingUpdates: true
    });
    console.log('🤖 Bot polling запущено');
    
    // HTTP server
    app.listen(PORT, () => {
      console.log(`🌐 HTTP server: http://localhost:${PORT}`);
      console.log(`📡 WayForPay: POST http://localhost:${PORT}/api/wayforpay/webhook`);
      console.log(`🏥 Health: GET http://localhost:${PORT}/health`);
    });
    
  } else {
    // Production webhook mode
    if (!WEBHOOK_BASE) {
      console.error('❌ MODE=webhook але WEBHOOK_URL порожній');
      process.exit(1);
    }
    
    const webhookPath = `/webhook/${TOKEN}`;
    const webhookUrl = `${WEBHOOK_BASE}${webhookPath}`;
    
    // Telegram webhook endpoint
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
      
      console.log(`📡 WayForPay: ${WEBHOOK_BASE}/api/wayforpay/webhook`);
      console.log(`🏥 Health: ${WEBHOOK_BASE}/health`);
    });
  }
  
  // Запускаємо scheduler після успішного старту бота
  setTimeout(async () => {
    try {
      await startScheduler(bot);
      console.log('⏱️ Scheduler запущено');
    } catch (e) {
      console.error('❌ Scheduler помилка:', e);
    }
  }, 3000);
};

// ——— 5) Graceful shutdown
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

// ——— 6) Запуск
startBot().catch(error => {
  console.error('❌ Критична помилка запуску:', error);
  process.exit(1);
});

// Експортуємо для інших модулів
export { bot };

console.log('🎉 Ініціалізація завершена → MODE=%s | TZ=%s | ENV=%s', MODE, process.env.TZ, process.env.NODE_ENV);