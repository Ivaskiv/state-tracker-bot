// server.js — стабільний webhook/polling + робочі сесії + онбординг

import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';

import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';
import { startScheduler } from './src/utils/scheduler.js';
import { SCHEDULE } from './src/config/constants.js';

// Dev утиліти (опційно, не падаємо якщо відсутні)
import { autoUpdateMenusOnDev, addDevMenuCommands } from './src/utils/devMenuUpdater.js';
import { installPendingFlow } from './src/middleware/pendingFlow.js';

dotenv.config();

// Фікс TZ до запуску кронів/бота
process.env.TZ = process.env.TZ || SCHEDULE.TIMEZONE;

const PORT = Number(process.env.PORT || 3000);
const MODE = process.env.MODE || 'local';          // 'local' (polling) | 'webhook' (prod)
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'development';
const WEBHOOK_BASE = process.env.WEBHOOK_URL || ''; // наприклад: https://yourdomain.com

console.log('🔍 Env check:', {
  MODE, PORT, TZ: process.env.TZ, NODE_ENV,
  TOKEN: TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING'
});

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

// ——— 1) Bot init + session першою мідлварою
const bot = new Telegraf(TOKEN);

bot.use(session({
  // дає валідний ctx.session навіть у «холодний» момент
  defaultSession: () => ({ step: undefined, temp: {} })
}));

// Ловимо типові фейли (409 — друга інстанція)
bot.catch((err, ctx) => {
  const msg = `${err?.message || ''} ${err?.description || ''}`;
  if (msg.includes('409') || msg.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict: інша інстанція вже тягне getUpdates. Зупини її.');
    return;
  }
  console.error('❌ Telegraf error:', err);
});

// ——— 2) Підключення хендлерів/мідлварів ПІСЛЯ session()
try {
  botController(bot);                    // реєструє всі команди/онбординг тощо
  installPendingFlow?.(bot);             // якщо є middleware очікувань
  addDevMenuCommands?.(bot);             // dev-команди (не критично)
  console.log('✅ Bot handlers installed');
} catch (e) {
  console.error('❌ Error installing bot handlers:', e);
  process.exit(1);
}

// ——— 3) Express (webhooks + health + dev)
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
    env: NODE_ENV,
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

// Dev endpoints (не у проді)
if (NODE_ENV !== 'production') {
  app.post('/dev/update-menus', async (_req, res) => {
    try {
      await autoUpdateMenusOnDev?.(bot);
      res.json({ status: 'success', message: 'Menus updated', at: new Date().toISOString() });
    } catch (e) {
      console.error('[dev/update-menus] error:', e);
      res.status(500).json({ status: 'error', message: e.message });
    }
  });

  app.post('/dev/test-webhook', async (_req, res) => {
    try {
      const testData = {
        merchantAccount: 'test_merch_n1',
        orderReference: `TEST_WEEK_${Date.now()}`,
        transactionStatus: 'Approved',
        amount: '7',
        currency: 'EUR',
        clientEmail: 'test@test.com',
        clientPhone: '+380123456789',
        createdDate: Math.floor(Date.now() / 1000),
        processingDate: Math.floor(Date.now() / 1000)
      };
      const processed = wayforpayService.processWebhookData(testData);
      const result = await handleWayForPayWebhook(processed);
      res.json({ status: 'success', processed, result });
    } catch (e) {
      console.error('[dev/test-webhook] error:', e);
      res.status(500).json({ status: 'error', message: e.message });
    }
  });

  console.log('🛠️ Dev endpoints ready: /dev/update-menus, /dev/test-webhook');
}

// Статика (якщо треба)
app.use('/static', express.static('public'));

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: `${req.method} ${req.path}`,
    endpoints: [
      'GET /health',
      'POST /api/wayforpay/webhook',
      ...(NODE_ENV !== 'production' ? ['POST /dev/update-menus', 'POST /dev/test-webhook'] : [])
    ]
  });
});

// ——— 4) Старт бота
if (MODE === 'local') {
  console.log(`💻 Local mode: polling + Express (PORT=${PORT})`);

  // гарантійно зносимо webhook
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('🧹 Webhook cleared (drop pending updates)');
  } catch (e) {
    console.warn('ℹ️ deleteWebhook warn:', e?.message);
  }

  // запуск polling (ВАЖЛИВО: allowedUpdates — camelCase)
 try {
    console.log('🔍 Запускаємо scheduler...');
    await startScheduler(bot);
    console.log('⏱️ Scheduler started');
  } catch (e) {
    console.error('❌ Scheduler start error:', e);
    console.log('🔄 Продовжуємо без scheduler...');
  }

  // Express
  app.listen(PORT, () => {
    console.log(`🌐 HTTP server on http://localhost:${PORT}`);
    console.log(`📡 WayForPay:  POST http://localhost:${PORT}/api/wayforpay/webhook`);
    console.log(`🏥 Health:     GET  http://localhost:${PORT}/health`);
  });
  // scheduler після старту бота
  try {
    await startScheduler(bot);
    console.log('⏱️ Scheduler started');
  } catch (e) {
    console.error('❌ Scheduler start error:', e);
    process.exit(1);
  }

  // автооновлення меню у dev
  if (NODE_ENV !== 'production') {
    try {
      await autoUpdateMenusOnDev?.(bot);
      console.log('🔄 Dev auto menu update done');
    } catch (e) {
      console.warn('ℹ️ autoUpdateMenusOnDev warn:', e?.message);
    }
  }

} else {
  // ——— Production / Webhook mode
  if (!WEBHOOK_BASE) {
    console.error('❌ MODE=webhook але WEBHOOK_URL порожній');
    process.exit(1);
  }

  const webhookPath = `/webhook/${TOKEN}`;
  const webhookUrl  = `${WEBHOOK_BASE}${webhookPath}`;

  // Telegram webhook endpoint
  app.use(webhookPath, bot.webhookCallback(webhookPath)); // надійніше за ручний handleUpdate

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

    // scheduler після успішного setWebhook
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

// ——— 6) Helpers (опційно)
export { bot };
export const sendTyping = async (ctx, delay = 800) => {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((r) => setTimeout(r, delay));
  } catch {}
};

console.log('🎉 Init done → MODE=%s | TZ=%s | ENV=%s', MODE, process.env.TZ, NODE_ENV);
