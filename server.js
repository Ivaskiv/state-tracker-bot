// server.js - ДОДАНО SESSION MIDDLEWARE

import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf'; // ДОДАНО session
import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';
import { installPendingFlow } from './src/middleware/pendingFlow.js';
import { startScheduler } from './src/utils/scheduler.js';
import { SCHEDULE } from './src/config/constants.js';

// ДОДАНО: автооновлення меню
import { autoUpdateMenusOnDev, addDevMenuCommands } from './src/utils/devMenuUpdater.js';

dotenv.config();

// Фікс часової зони ДО запуску cron/polling
process.env.TZ = process.env.TZ || SCHEDULE.TIMEZONE;

const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'local';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('🔍 Environment check:');
console.log('- MODE:', MODE);
console.log('- PORT:', PORT);
console.log('- TOKEN:', TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING');
console.log('- TZ:', process.env.TZ);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'не встановлено');
console.log('- DEV MODE:', process.env.NODE_ENV !== 'production' ? 'УВІМКНЕНО' : 'ВИМКНЕНО');

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

console.log('🤖 Initializing bot...');
const bot = new Telegraf(TOKEN);

// ВИПРАВЛЕНО: додаємо session middleware ПЕРЕД усіма іншими middleware
bot.use(session());

bot.catch((err) => {
  console.error('❌ Bot error:', err);
  if (err.code === 409 && err.description?.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict detected: Another bot instance is running.');
  }
});

console.log('🎮 Loading bot controller...');
try {
  botController(bot);
  console.log('✅ Bot controller loaded');
} catch (error) {
  console.error('❌ Error loading bot controller:', error);
  process.exit(1);
}

console.log('🛠️ Installing pending flow middleware...');
try {
  installPendingFlow(bot);
  console.log('✅ Pending flow middleware installed');
} catch (error) {
  console.error('❌ Error installing pending flow middleware:', error);
  process.exit(1);
}

console.log('🛠️ Adding dev commands...');
try {
  addDevMenuCommands(bot);
  console.log('✅ Dev commands added');
} catch (error) {
  console.error('❌ Error adding dev commands:', error);
}

console.log('⏰ Initializing scheduler...');
try {
  startScheduler(bot);
  console.log('✅ Scheduler initialized');
} catch (error) {
  console.error('❌ Error initializing scheduler:', error);
  process.exit(1);
}

// ==== Express (webhook + health) ====
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bot: 'running',
    tz: process.env.TZ,
    dev_mode: process.env.NODE_ENV !== 'production'
  });
});

app.post('/api/wayforpay/webhook', async (req, res) => {
  try {
    console.log('[webhook] WayForPay payload:', req.body);
    const processedData = wayforpayService.processWebhookData(req.body);
    await handleWayForPayWebhook(processedData);
    const response = wayforpayService.generateWebhookResponse('accept');
    res.json(response);
    console.log('[webhook] ✅ processed');
  } catch (error) {
    console.error('[webhook] ❌ error:', error);
    const response = wayforpayService.generateWebhookResponse('decline');
    res.status(400).json(response);
  }
});

// DEV endpoint для ручного оновлення меню
if (process.env.NODE_ENV !== 'production') {
  app.post('/dev/update-menus', async (req, res) => {
    try {
      const { quickMenuUpdate } = await import('./src/utils/devMenuUpdater.js');
      await quickMenuUpdate(bot);
      res.json({ status: 'success', message: 'Menus updated for all users' });
    } catch (error) {
      console.error('[dev-endpoint] Помилка оновлення меню:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });
  
  console.log('🛠️ Dev endpoint added: POST /dev/update-menus');
}

// ==== Run bot ====
if (MODE === 'local') {
  console.log(`💻 Local mode: polling + Express webhook server (PORT=${PORT})`);

  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook cleared');
  } catch (error) {
    console.error('❌ Failed to clear webhook:', error);
  }

  await new Promise((r) => setTimeout(r, 1000));

  console.log('🔄 Starting polling...');
  try {
    await bot.launch({
      polling: {
        timeout: 30,
        limit: 100,
        allowed_updates: ['message', 'callback_query'],
      },
    });
    console.log('✅ Polling started');
    
    // Автооновлення меню після запуску бота
    console.log('🔄 Starting auto menu update...');
    await autoUpdateMenusOnDev(bot);
    
  } catch (error) {
    console.error('❌ STARTUP ERROR (polling):', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🌐 Webhook server running on http://localhost:${PORT}`);
    console.log(`📡 WayForPay endpoint: http://localhost:${PORT}/api/wayforpay/webhook`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🛠️ Dev menu update endpoint: http://localhost:${PORT}/dev/update-menus`);
    }
  });
} else {
  console.log(`🚀 Production mode: webhook server (PORT=${PORT})`);

  const webhookUrl = `${process.env.WEBHOOK_URL || 'https://yourdomain.com'}/webhook/${TOKEN}`;

  app.use(`/webhook/${TOKEN}`, (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
  });

  app.listen(PORT, async () => {
    console.log(`🌐 Server running on port ${PORT}`);
    try {
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook set to: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
    }
  });
}

const sendTyping = async (ctx, delay = 800) => {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((resolve) => setTimeout(resolve, delay));
  } catch {}
};

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

export { bot, sendTyping };