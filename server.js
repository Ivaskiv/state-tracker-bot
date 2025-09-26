// server.js - ОПТИМІЗОВАНИЙ СЕРВЕР З ПОВНОЮ ЛОГІКОЮ

import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';
import path from 'path';

// Завантажуємо змінні оточення першими
dotenv.config();

// Перевіряємо критичні змінні
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'AIRTABLE_API_KEY', 
  'AIRTABLE_BASE_ID',
  'OPENAI_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ${envVar} відсутній в .env`);
    process.exit(1);
  }
}

console.log('✅ [SERVER] Всі змінні оточення готові');

// Імпортуємо модулі після налаштування env
import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import paymentService from './src/auth/services/paymentService.js';
import { startScheduler } from './src/utils/scheduler.js';
import { testConnection } from './src/config/database.js';

// Налаштування
const PORT = Number(process.env.PORT || 3000);
const MODE = process.env.NODE_ENV === 'production' ? 'webhook' : 'local';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE = process.env.WEBHOOK_URL || '';

// Встановлюємо часовий пояс
process.env.TZ = 'Europe/Kyiv';

// Створюємо бота
const bot = new Telegraf(TOKEN, {
  handlerTimeout: 90000 // 90 секунд timeout для handlers
});

// Ініціалізуємо session middleware
bot.use(session({
  defaultSession: () => ({
    step: undefined,
    temp: {},
    wheel: null,
    ai: null,
    lastCommand: null,
    commandTime: null
  })
}));

// Глобальна обробка помилок бота
bot.catch(async (err, ctx) => {
  console.error('❌ [BOT ERROR]', {
    error: err.message,
    update: ctx.update?.message?.text || ctx.update?.callback_query?.data,
    user: ctx.from?.id
  });
  
  try {
    await ctx.reply('❌ Виникла технічна помилка. Спробуй /start');
  } catch (replyError) {
    console.error('❌ Не вдалося надіслати повідомлення про помилку');
  }
});

// Підключаємо контролери бота
console.log('🤖 [SERVER] Підключення bot handlers...');
try {
  botController(bot);
  console.log('✅ [SERVER] Bot handlers встановлено');
} catch (error) {
  console.error('❌ [SERVER] Помилка встановлення bot handlers:', error);
  process.exit(1);
}

// Express сервер
const app = express();

// Налаштування middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статичні файли
app.use('/static', express.static(path.join(process.cwd(), 'public')));

// CORS для development
if (MODE === 'local') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

// Health endpoint
app.get('/health', async (req, res) => {
  try {
    // Перевіряємо з'єднання з базою
    const dbStatus = await testConnection();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      bot: 'running',
      database: dbStatus.success ? 'connected' : 'error',
      timezone: process.env.TZ,
      mode: MODE,
      version: '2.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint для моніторингу
app.get('/status', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heap: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
    },
    node_version: process.version,
    mode: MODE
  });
});

// WayForPay webhook endpoint з розширеною обробкою
app.post('/api/wayforpay/webhook', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('[WEBHOOK] 🔔 WayForPay webhook отримано');
    console.log('[WEBHOOK] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[WEBHOOK] Body:', JSON.stringify(req.body, null, 2));
    
    // Обробляємо webhook
    const processed = wayforpayService.processWebhookData(req.body);
    const result = await paymentService.handleWayForPayWebhook(processed);
    
    // Генеруємо відповідь
    const response = wayforpayService.generateWebhookResponse('accept');
    
    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK] ✅ Webhook оброблено за ${processingTime}ms`);
    
    res.json(response);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[WEBHOOK] ❌ Помилка webhook за ${processingTime}ms:`, error);
    
    const response = wayforpayService.generateWebhookResponse('decline');
    res.status(400).json(response);
  }
});

// Endpoint для тестування платежів (тільки в development)
if (MODE === 'local') {
  app.post('/api/test/payment', async (req, res) => {
    try {
      const { tgId, planKey = 'MONTH' } = req.body;
      
      if (!tgId) {
        return res.status(400).json({ error: 'tgId required' });
      }
      
      // Симулюємо успішний платіж
      const testWebhookData = {
        merchantAccount: 'test_merchant',
        orderReference: `TEST_${planKey}_${tgId}_${Date.now()}`,
        amount: planKey === 'WEEK' ? 7 : planKey === 'MONTH' ? 30 : 300,
        currency: 'EUR',
        transactionStatus: 'Approved',
        clientEmail: `test${tgId}@example.com`,
        merchantSignature: 'test_signature'
      };
      
      const processed = {
        tgId: String(tgId),
        orderReference: testWebhookData.orderReference,
        transactionStatus: 'Approved',
        amount: testWebhookData.amount,
        currency: 'EUR',
        email: testWebhookData.clientEmail,
        planName: `Тест ${planKey}`,
        planKey: planKey,
        planDuration: planKey === 'WEEK' ? 7 : planKey === 'MONTH' ? 30 : 365,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + (planKey === 'WEEK' ? 7 : planKey === 'MONTH' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString()
      };
      
      await paymentService.handleWayForPayWebhook(processed);
      
      res.json({ success: true, message: 'Test payment processed' });
      
    } catch (error) {
      console.error('[TEST PAYMENT] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('[EXPRESS ERROR]', error);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Функція запуску бота
const startBot = async () => {
  try {
    if (MODE === 'local') {
      console.log('🖥️ [SERVER] Local mode: long polling');
      
      // Очищаємо webhook перед запуском polling
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('🧹 [SERVER] Webhook cleared');
      } catch (e) {
        console.warn('⚠️ [SERVER] deleteWebhook warn:', e?.message);
      }
      
      // Запускаємо polling
      await bot.launch({
        allowedUpdates: ['message', 'callback_query'],
        dropPendingUpdates: true,
        polling: {
          timeout: 30,
          limit: 100
        }
      });
      
      console.log('🤖 [SERVER] Bot polling запущено');
      
      // Запускаємо HTTP сервер
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 [SERVER] HTTP server: http://localhost:${PORT}`);
        console.log(`🔗 [SERVER] Health check: http://localhost:${PORT}/health`);
        console.log(`📊 [SERVER] Status: http://localhost:${PORT}/status`);
      });
      
    } else {
      console.log('🚀 [SERVER] Production mode: webhook');
      
      if (!WEBHOOK_BASE) {
        throw new Error('WEBHOOK_URL не встановлено для production режиму');
      }
      
      const webhookPath = `/webhook/${TOKEN}`;
      const webhookUrl = `${WEBHOOK_BASE}${webhookPath}`;
      
      // Налаштовуємо webhook endpoint
      app.use(webhookPath, bot.webhookCallback(webhookPath));
      
      // Запускаємо сервер
      app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 [SERVER] Production server на порт ${PORT}`);
        
        try {
          // Встановлюємо webhook
          await bot.telegram.setWebhook(webhookUrl, {
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true,
            max_connections: 100
          });
          
          console.log(`✅ [SERVER] Webhook встановлено: ${webhookUrl}`);
          
        } catch (error) {
          console.error('❌ [SERVER] setWebhook error:', error);
          process.exit(1);
        }
      });
    }
    
    // Запускаємо scheduler через 5 секунд після успішного запуску бота
    setTimeout(async () => {
      try {
        await startScheduler(bot);
        console.log('⏰ [SERVER] Scheduler запущено');
      } catch (error) {
        console.error('❌ [SERVER] Scheduler помилка:', error);
      }
    }, 5000);
    
    // Тест з'єднання з базою
    setTimeout(async () => {
      try {
        const dbTest = await testConnection();
        if (dbTest.success) {
          console.log('✅ [SERVER] Database connection успішний');
        } else {
          console.error('❌ [SERVER] Database connection помилка:', dbTest.error);
        }
      } catch (error) {
        console.error('❌ [SERVER] Database test error:', error);
      }
    }, 3000);
    
    console.log('✅ [SERVER] AI-наставник бот успішно запущено!');
    console.log(`📅 [SERVER] Mode: ${MODE}`);
    console.log(`🕐 [SERVER] Timezone: ${process.env.TZ}`);
    
  } catch (error) {
    console.error('❌ [SERVER] Критична помилка запуску:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`🛑 [SERVER] ${signal} отримано, зупинка...`);
  
  try {
    // Зупиняємо scheduler
    const { stopScheduler } = await import('./src/utils/scheduler.js');
    stopScheduler();
    
    // Зупиняємо бота
    await bot.stop(signal);
    console.log('✅ [SERVER] Bot зупинено');
    
  } catch (error) {
    console.error('❌ [SERVER] Помилка при зупинці:', error);
  } finally {
    process.exit(0);
  }
};

// Обробники сигналів
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Обробник необроблених помилок
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [SERVER] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ [SERVER] Uncaught Exception:', error);
  process.exit(1);
});

// Запуск
startBot().catch(error => {
  console.error('❌ [SERVER] Критична помилка запуску:', error);
  process.exit(1);
});

// Експортуємо для використання в інших модулях
export { bot, app };