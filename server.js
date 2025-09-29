// server.js - МІНІМАЛЬНИЙ ЗАПУСК

import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import botController from './src/controllers/botController.js';

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній');
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Session для збереження тимчасових даних
bot.use(session({
  defaultSession: () => ({})
}));

// Ініціалізація контролерів
botController(bot);

// Запуск
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    await bot.launch();
    console.log('✅ Бот запущено');
  } catch (error) {
    console.error('❌ Помилка запуску:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));