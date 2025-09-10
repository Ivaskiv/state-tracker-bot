// import express from 'express';                    // [SERVER DISABLED]
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import botController from './src/controllers/botController.js';
// import { handleWayForPayWebhook } from './src/auth/services/paymentService.js'; // [SERVER DISABLED]
import { installPendingFlow } from './src/middleware/pendingFlow.js';
import { startScheduler } from './src/utils/scheduler.js'; // ⬅️ ДОДАНО

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
  console.error('Set TELEGRAM_BOT_TOKEN in your environment variables (.env).');
  process.exit(1);
}

console.log('🤖 Initializing bot...');
const bot = new Telegraf(TOKEN);
console.log('✅ New bot instance created');

bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  console.error('- Update:', ctx?.update);
  if (err.code === 409 && err.description?.includes('terminated by other getUpdates')) {
    console.error('❌ Conflict detected: Another bot instance is running. Please ensure only one instance is active.');
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

let schedulerInitialized = false;
console.log('⏰ Initializing scheduler...');
try {
  if (!schedulerInitialized) {
    console.log('🔄 Starting scheduler initialization...');
    startScheduler(bot); // ⬅️ тепер визначено
    schedulerInitialized = true;
    console.log('✅ Scheduler initialized');
  } else {
    console.log('⚠️ Scheduler already initialized, skipping...');
  }
} catch (error) {
  console.error('❌ Error initializing scheduler:', error);
  process.exit(1);
}

(async () => {
  console.log(`💻 Local launch without Express server (PORT=${PORT}, MODE=${MODE})`);
  console.log('🔧 Setting up LOCAL mode (polling)...');

  console.log('🗑️ Clearing webhook and pending updates...');
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
    console.log('✅ Polling started (LOCAL)');
  } catch (error) {
    console.error('❌ STARTUP ERROR (polling):', error);
    process.exit(1);
  }

  console.log('🔍 Testing connection to Telegram...');
  try {
    const me = await bot.telegram.getMe();
    console.log(`✅ Connected to Telegram as @${me.username} (${me.first_name})`);
  } catch (error) {
    console.error('❌ Failed to get bot info:', error);
  }
})();

const sendTyping = async (ctx, delay = 800) => {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
  } catch {}
  try {
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
