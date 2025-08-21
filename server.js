// server.js
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { initScheduler } from "./src/utils/scheduler.js";
import { handleStart } from "./src/services/userService.js";
import fs from "fs";

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN не заданий у .env");
  process.exit(1);
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// =====================
// /start
// =====================
bot.start(async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name;
  const { user, subscriptionActive } = await handleStart({ tgId, name });

  await ctx.reply(
    `Привіт, ${name}! Твій профіль готовий. Підписка: ${subscriptionActive ? "активна" : "неактивна"}`
  );
});

// =====================
// Scheduler запускаємо завжди
// =====================
initScheduler(bot);

// =====================
// Express + webhook / polling
// =====================
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
    console.log(`✅ Webhook встановлено: ${process.env.APP_URL}${webhookPath}`);
  });

} else {
  bot.launch({ polling: true }).then(() => {
    console.log(`🚀 Bot running in polling mode`);
  });
}
