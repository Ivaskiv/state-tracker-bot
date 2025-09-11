// server.js
import express from 'express';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import botController from './src/controllers/botController.js';
import wayforpayService from './src/services/wayforpayService.js';
import { handleWayForPayWebhook } from './src/auth/services/paymentService.js';
import { installPendingFlow } from './src/middleware/pendingFlow.js';
import { startScheduler } from './src/utils/scheduler.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'local';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('🔍 Environment check:');
console.log('- MODE:', MODE);
console.log('- PORT:', PORT);
console.log('- TOKEN:', TOKEN ? `${TOKEN.slice(0, 10)}...` : 'MISSING');

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

console.log('🤖 Initializing bot...');
const bot = new Telegraf(TOKEN);

bot.catch((err, ctx) => {
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
  console.log('✅ Pending flow logic moved to botController');
} catch (error) {
  console.error('❌ Error installing pending flow middleware:', error);
  process.exit(1);
}

console.log('⏰ Initializing scheduler...');
try {
  startScheduler(bot);
  console.log('✅ Scheduler initialized');
} catch (error) {
  console.error('❌ Error initializing scheduler:', error);
  process.exit(1);
}

// Налаштування Express для webhook
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    bot: 'running'
  });
});

// WayForPay webhook endpoint
app.post('/api/wayforpay/webhook', async (req, res) => {
  try {
    console.log('[webhook] Отримано WayForPay webhook:', req.body);
    
    // Обробляємо webhook через wayforpayService
    const processedData = wayforpayService.processWebhookData(req.body);
    
    // Викликаємо існуючий обробник
    const result = await handleWayForPayWebhook(processedData);
    
    // Відповідаємо WayForPay
    const response = wayforpayService.generateWebhookResponse('accept');
    res.json(response);
    
    console.log('[webhook] Webhook успішно оброблено');
  } catch (error) {
    console.error('[webhook] Помилка обробки webhook:', error);
    
    const response = wayforpayService.generateWebhookResponse('decline');
    res.status(400).json(response);
  }
});

// Запуск сервера
if (MODE === 'local') {
  // Локальний режим: polling + Express для webhook
  console.log(`💻 Local mode: polling + Express webhook server (PORT=${PORT})`);
  
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook cleared');
  } catch (error) {
    console.error('❌ Failed to clear webhook:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

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
  } catch (error) {
    console.error('❌ STARTUP ERROR (polling):', error);
    process.exit(1);
  }

  // Запускаємо Express сервер для webhook
  app.listen(PORT, () => {
    console.log(`🌐 Webhook server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/api/wayforpay/webhook`);
  });
  
} else {
  // Production режим: webhook
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