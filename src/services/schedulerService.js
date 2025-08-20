// src/services/schedulerService.js
import cron from "node-cron";

const setupScheduler = (bot) => {
  console.log("⏰ Scheduler initialized");

  // Ранкові питання
  cron.schedule("0 8 * * *", () => {
    bot.sendMessage(process.env.ADMIN_ID, "📝 Ранкові питання");
  });

  // Вечірні питання
  cron.schedule("30 20 * * *", () => {
    bot.sendMessage(process.env.ADMIN_ID, "🌙 Вечірні питання");
  });

  // Щотижневий звіт (неділя 21:00)
  cron.schedule("0 21 * * 0", () => {
    bot.sendMessage(process.env.ADMIN_ID, "📊 Щотижневий звіт");
  });

  // Щомісячний звіт (останній день місяця 22:00)
  cron.schedule("0 22 28-31 * *", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (tomorrow.getDate() === 1) {
      bot.sendMessage(process.env.ADMIN_ID, "📊 Місячний звіт");
    }
  });
};

export default {
  setupScheduler,
};
