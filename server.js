// server.js - ВИПРАВЛЕНО: розділення локал/продакшн + правильний порядок ініціалізації

import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';

import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';
import { startScheduler } from './src/utils/scheduler.js';
import { SCHEDULE } from './src/config/constants.js';

console.log('🔍 [DEBUG] Змінні оточення:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET');
console.log('- AIRTABLE_API_KEY:', process.env.AIRTABLE_API_KEY ? 'SET' : 'NOT SET');
console.log('- AIRTABLE_BASE_ID:', process.env.AIRTABLE_BASE_ID ? 'SET' : 'NOT SET');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');

// Dev утиліти (тільки для локальної розробки)
let autoUpdateMenusOnDev, addDevMenuCommands, installPendingFlow;
if (process.env.NODE_ENV === 'development') {
  try {
    const devModule = await import('./src/utils/devMenuUpdater.js');
    autoUpdateMenusOnDev = devModule.autoUpdateMenusOnDev;
    addDevMenuCommands = devModule.addDevMenuCommands;
    
    const pendingModule = await import('./src/middleware/pendingFlow.js');
    installPendingFlow = pendingModule.installPendingFlow;
  } catch (e) {
    console.warn('⚠️ Dev модулі недоступні:', e.message);
  }
}

dotenv.config();

// Фікс TZ до запуску
process.env.TZ = process.env.TZ || SCHEDULE.TIMEZONE;

const PORT = Number(process.env.PORT || 3000);
const MODE = process.env.NODE_ENV === 'development' ? 'local' : 'webhook';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE = process.env.WEBHOOK_URL || '';

console.log('🔍 Env check:', {
  MODE, PORT, TZ: process.env.TZ, NODE_ENV: process.env.NODE_ENV,
  TOKEN: TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING'
});

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

// ——— 1) Bot init + session
const bot = new Telegraf(TOKEN);

bot.use(session({
  defaultSession: () => ({ step: undefined, temp: {} })
}));

// Ловимо типові фейли
bot.catch((err, ctx) => {
  const msg = `${err?.message || ''} ${err?.description || ''}`;
  if (msg.includes('409') || msg.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict: інша інстанція вже тягне getUpdates. Зупини її.');
    return;
  }
  console.error('❌ Telegraf error:', err);
});

// ——— 2) Підключення хендлерів
try {
  botController(bot);
  if (installPendingFlow) installPendingFlow(bot);
  if (addDevMenuCommands) addDevMenuCommands(bot);
  console.log('✅ Bot handlers installed');
} catch (e) {
  console.error('❌ Error installing bot handlers:', e);
  process.exit(1);
}

// ——— 3) Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health
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

// WayForPay webhook
app.post('/api/wayforpay/webhook', async (req, res) => {
  try {
    console.log('[W4P] 🔔 webhook payload:', JSON.stringify(req.body));
    const processed = wayforpayService.processWebhookData(req.body);
    const result = await handleWayForPayWebhook(processed);
    const response = wayforpayService.generateWebhookResponse('accept');
    console.log('[W4P] ✅ processed:', result);
    res.json(response);
  } catch (error) {
    console.error('[W4P] ❌ webhook error:', error);
    const response = wayforpayService.generateWebhookResponse('decline');
    res.status(400).json(response);
  }
});

// Dev endpoints (тільки локально)
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/update-menus', async (_req, res) => {
    try {
      if (autoUpdateMenusOnDev) await autoUpdateMenusOnDev(bot);
      res.json({ status: 'success', message: 'Menus updated', at: new Date().toISOString() });
    } catch (e) {
      console.error('[dev/update-menus] error:', e);
      res.status(500).json({ status: 'error', message: e.message });
    }
  });

  console.log('🛠️ Dev endpoints ready: /dev/update-menus');
}

app.use('/static', express.static('public'));

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: `${req.method} ${req.path}`,
    endpoints: [
      'GET /health',
      'POST /api/wayforpay/webhook',
      ...(process.env.NODE_ENV === 'development' ? ['POST /dev/update-menus'] : [])
    ]
  });
});

// ——— 4) Старт бота
if (MODE === 'local') {
  console.log(`💻 Local mode: polling + Express (PORT=${PORT})`);

  // Очищуємо webhook
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('🧹 Webhook cleared');
  } catch (e) {
    console.warn('ℹ️ deleteWebhook warn:', e?.message);
  }

  // Запуск polling
  bot.launch({
    allowedUpdates: ['message', 'callback_query']
  }).then(() => {
    console.log('🤖 Bot polling started');
  });

  // Express
  app.listen(PORT, () => {
    console.log(`🌐 HTTP server on http://localhost:${PORT}`);
    console.log(`📡 WayForPay:  POST http://localhost:${PORT}/api/wayforpay/webhook`);
    console.log(`🏥 Health:     GET  http://localhost:${PORT}/health`);
  });

  // Scheduler після успішного запуску бота
  setTimeout(async () => {
    try {
      await startScheduler(bot);
      console.log('⏱️ Scheduler started');
    } catch (e) {
      console.error('❌ Scheduler start error:', e);
    }
  }, 2000);

  // Dev автооновлення меню
  if (autoUpdateMenusOnDev) {
    setTimeout(async () => {
      try {
        await autoUpdateMenusOnDev(bot);
        console.log('🔄 Dev auto menu update done');
      } catch (e) {
        console.warn('ℹ️ autoUpdateMenusOnDev warn:', e?.message);
      }
    }, 3000);
  }

} else {
  // ——— Production / Webhook mode
  if (!WEBHOOK_BASE) {
    console.error('❌ MODE=webhook але WEBHOOK_URL порожній');
    process.exit(1);
  }

  const webhookPath = `/webhook/${TOKEN}`;
  const webhookUrl = `${WEBHOOK_BASE}${webhookPath}`;

  // Telegram webhook endpoint
  app.use(webhookPath, bot.webhookCallback(webhookPath));

  app.listen(PORT, async () => {
    console.log(`🚀 Production server on :${PORT}`);
    try {
      await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      });
      console.log(`✅ Telegram webhook set: ${webhookUrl}`);
    } catch (e) {
      console.error('❌ setWebhook error:', e);
      process.exit(1);
    }

    console.log(`📡 WayForPay webhook: ${WEBHOOK_BASE}/api/wayforpay/webhook`);
    console.log(`🏥 Health:            ${WEBHOOK_BASE}/health`);

    // Scheduler після успішного setWebhook
    try {
      await startScheduler(bot);
      console.log('⏱️ Scheduler started');
    } catch (e) {
      console.error('❌ Scheduler start error:', e);
      process.exit(1);
    }
  });
}

// ——— 5) Graceful shutdown
const shutdown = async (signal) => {
  console.log(`🛑 ${signal}: stopping...`);
  try {
    await bot.stop(signal);
    console.log('✅ Bot stopped');
  } catch (e) {
    console.error('❌ stop error:', e);
  } finally {
    process.exit(0);
  }
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// ——— 6) Helpers
export { bot };
export const sendTyping = async (ctx, delay = 800) => {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((r) => setTimeout(r, delay));
  } catch {}
};

console.log('🎉 Init done → MODE=%s | TZ=%s | ENV=%s', MODE, process.env.TZ, process.env.NODE_ENV);