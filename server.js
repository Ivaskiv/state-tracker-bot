import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import keyboards from './src/utils/keyboards.js';
import reflectionService from './src/services/reflectionService.js';
import userService from './src/services/userService.js';
import { initScheduler } from './src/utils/scheduler.js';

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не заданий у .env');
  process.exit(1);
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /start
bot.start(async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  const { user, subscriptionActive } = await userService.handleStart({ tgId, name });

  await ctx.reply(
    `Привіт, ${name}! Твій профіль готовий. Підписка: ${subscriptionActive ? 'активна' : 'неактивна'}`,
    keyboards.mainMenuKeyboard()
  );
});

// Основні команди
bot.hears('🌞 Ранкові питання', async (ctx) => {
  await reflectionService.sendQuestions(bot, ctx.from.id, 'morning');
});

bot.hears('🌙 Вечірні питання', async (ctx) => {
  await reflectionService.sendQuestions(bot, ctx.from.id, 'evening');
});

// Текстові повідомлення (не обробляємо, бо всі питання надсилаються автоматично)
bot.on('text', async (ctx) => {});

// Scheduler
initScheduler(bot);

// Polling
bot.launch({ polling: true }).then(() => console.log('🚀 Bot running in polling mode'));

/* Webhook поки закоментовано
const useWebhook = process.env.USE_WEBHOOK === 'true';
if (useWebhook) {
  const express = require('express');
  const bodyParser = require('body-parser');
  const app = express();
  app.use(bodyParser.json());

  const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
  bot.telegram.setWebhook(`${process.env.APP_URL}${webhookPath}`);
  app.post(webhookPath, (req, res) => bot.handleUpdate(req.body, res));

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 Server running with webhook on port ${port}`));
}
*/
