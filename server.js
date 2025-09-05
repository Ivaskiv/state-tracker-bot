import express from 'express';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import botController from './src/controllers/botController.js';
import { initScheduler } from './src/questions/utils/scheduler.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'local';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Валідація середовища
console.log('🔍 Environment check:');
console.log('- MODE:', MODE);
console.log('- PORT:', PORT);
console.log('- TOKEN:', TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING');
console.log('- WEBHOOK_URL:', WEBHOOK_URL || 'NOT SET');

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

// Singleton для бота
console.log('🤖 Initializing bot...');
let bot = globalThis.__bot;
if (!bot) {
  bot = new Telegraf(TOKEN);
  globalThis.__bot = bot;
  console.log('✅ New bot instance created');
} else {
  console.log('♻️ Reusing existing bot instance');
}

// Обробка помилок бота
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  console.error('- Update:', ctx?.update);
  if (err.code === 409 && err.description?.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict detected: Another bot instance is running. Please ensure only one instance is active.');
  }
});

// Налаштування Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook для WayForPay
app.post('/wayforpay-webhook', async (req, res) => {
  try {
    await handleWayForPayWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ WayForPay webhook error:', error);
    res.status(500).send('Error');
  }
});

// Кореневий маршрут
app.get('/', (_req, res) => res.send('Bot is running!'));

// Health check ендпоінт
app.get('/health', async (_req, res) => {
  try {
    const me = await bot.telegram.getMe();
    res.json({
      status: 'ok',
      bot: me,
      mode: MODE,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      mode: MODE,
    });
  }
});

// Ініціалізація контролерів
console.log('🎮 Loading bot controller...');
try {
  botController(bot);
  console.log('✅ Bot controller loaded');
} catch (error) {
  console.error('❌ Error loading bot controller:', error);
  process.exit(1);
}

// Ініціалізація планувальника
console.log('⏰ Initializing scheduler...');
try {
  initScheduler(bot);
  console.log('✅ Scheduler initialized');
} catch (error) {
  console.error('❌ Error initializing scheduler:', error);
  process.exit(1);
});

// Запуск бота
app.listen(PORT, async () => {
  console.log(`💻 Express app listening on port ${PORT}`);
  console.log(`⚙️ Running in MODE: ${MODE}`);

  try {
    if (MODE === 'local') {
      console.log('🔧 Setting up LOCAL mode (polling)...');

      // Очищення вебхука та попередніх оновлень
      console.log('🗑️ Clearing webhook and pending updates...');
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook cleared');
      } catch (error) {
        console.error('❌ Failed to clear webhook:', error);
      }

      // Зупинка попереднього polling
      console.log('🛑 Stopping any existing polling...');
      try {
        await bot.stop();
        console.log('✅ Previous polling stopped');
      } catch (error) {
        console.error('❌ Error stopping previous polling:', error);
      }

      // Перевірка наявних оновлень
      console.log('🔍 Checking existing updates...');
      try {
        const updates = await bot.telegram.getUpdates();
        console.log('Existing updates:', updates.length ? updates : 'None');
      } catch (error) {
        console.error('❌ Error checking updates:', error);
      }

      // Запуск polling
      console.log('🔄 Starting polling...');
      await bot.launch({
        polling: {
          timeout: 50,
          allowed_updates: ['message', 'callback_query'],
        },
      });
      console.log('✅ Polling started (LOCAL)');
    } else {
      console.log('🌐 Setting up PRODUCTION mode (webhook)...');

      if (!WEBHOOK_URL) {
        console.error('❌ WEBHOOK_URL is missing in production mode');
        console.log('Set WEBHOOK_URL environment variable to your app URL');
        process.exit(1);
      }

      const path = `/webhook/${TOKEN}`;
      const fullWebhookUrl = `${WEBHOOK_URL}${path}`;

      console.log(`🔗 Setting webhook: ${fullWebhookUrl}`);
      try {
        await bot.telegram.setWebhook(fullWebhookUrl, {
          drop_pending_updates: true,
        });
        console.log('✅ Webhook set successfully');
      } catch (error) {
        console.error('❌ Failed to set webhook:', error);
        process.exit(1);
      }

      app.use(path, bot.webhookCallback(path));
      console.log(`📡 Webhook callback registered at: ${path}`);
      console.log('✅ Production mode ready');
    }

    // Перевірка з'єднання з Telegram
    console.log('🔍 Testing connection to Telegram...');
    const me = await bot.telegram.getMe();
    console.log(`✅ Connected to Telegram as @${me.username} (${me.first_name})`);
  } catch (error) {
    console.error('❌ STARTUP ERROR:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.description,
    });
    console.log('⚠️ Bot startup failed, but Express server is still running');
  }
});

// Грейсфул-стоп
process.once('SIGINT', async () => {
  console.log('🛑 Received SIGINT, stopping bot...');
  try {
    await bot.stop('SIGINT');
    console.log('✅ Bot stopped successfully');
  } catch (error) {
    console.error('❌ Error stopping bot:', error);
  }
  process.exit(0);
});

process.once('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, stopping bot...');
  try {
    await bot.stop('SIGTERM');
    console.log('✅ Bot stopped successfully');
  } catch (error) {
    console.error('❌ Error stopping bot:', error);
  }
  process.exit(0);
});

export { bot };