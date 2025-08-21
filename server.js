// server.js
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { initScheduler } from "./src/utils/scheduler.js";
import userService from "./src/services/userService.js";
import reflectionService from "./src/services/reflectionService.js";
import affirmationService from "./src/services/affirmationService.js";
import keyboards from "./src/utils/keyboards.js";

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN не заданий у .env");
  process.exit(1);
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /start
bot.start(async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name;
  const { user, subscriptionActive } = await userService.handleStart({ tgId, name });

  await ctx.reply(
    `Привіт, ${name}! Твій профіль готовий. Підписка: ${subscriptionActive ? "активна" : "неактивна"}`,
    keyboards.mainMenuKeyboard()
  );
});

// Основні команди
bot.hears("🌞 Ранкові питання", async (ctx) => {
  await reflectionService.startDailyQuestions(bot, ctx.from.id, "morning");
});

bot.hears("🌙 Вечірні питання", async (ctx) => {
  await reflectionService.startDailyQuestions(bot, ctx.from.id, "evening");
});

bot.hears("💎 Афірмація", async (ctx) => {
  const affirmation = await affirmationService.getAffirmationAndMarkUsed();
  await ctx.reply(`🌀 ${affirmation}`);
});

bot.hears(["💰 Підписка", "📊 Мій прогрес", "❓ Допомога"], async (ctx) => {
  await ctx.reply("Функція у розробці", keyboards.mainMenuKeyboard());
});

// Обробка текстових повідомлень
bot.on("text", async (ctx) => {
  await reflectionService.handleIncomingText(bot, ctx);
});

// Scheduler
initScheduler(bot);

// Express + webhook / polling
const useWebhook = process.env.USE_WEBHOOK === "true";
const port = process.env.PORT || 3000;

if (useWebhook) {
  const app = express();
  app.use(bodyParser.json());

  const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
  bot.telegram.setWebhook(`${process.env.APP_URL}${webhookPath}`);
  app.post(webhookPath, (req, res) => bot.handleUpdate(req.body, res));

  app.listen(port, () => {
    console.log(`🌐 Server running with webhook on port ${port}`);
  });
} else {
  bot.launch({ polling: true }).then(() => {
    console.log(`🚀 Bot running in polling mode`);
  });
}
