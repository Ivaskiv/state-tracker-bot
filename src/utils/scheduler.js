// src/utils/scheduler.js
import cron from "node-cron";
import userService from "../services/userService.js";
import reflectionService from "../services/reflectionService.js";

const TIMEZONE = "Europe/Kiev";

const sendQuestionToUsers = async (bot, type) => {
  try {
    const activeUsers = await userService.getActiveUsers();
    for (const user of activeUsers) {
      const alreadyAnswered = await reflectionService.alreadyAnsweredToday(user.TG_id, type);
      if (!alreadyAnswered) {
        await reflectionService.startDailyQuestions(bot, user.TG_id, type);
      }
    }
    console.log(`✅ ${type} питання надіслано користувачам`);
  } catch (error) {
    console.error(`Помилка в ${type} питаннях:`, error);
  }
};

export const initScheduler = (bot) => {
  console.log("⏰ Scheduler initialized");

  // Тестове ранкове питання щодня о 12:30
  cron.schedule("30 12 * * *", async () => {
    await sendQuestionToUsers(bot, "morning");
  }, { timezone: TIMEZONE });

  // Вечірні питання 20:30
  cron.schedule("30 20 * * *", async () => {
    await sendQuestionToUsers(bot, "evening");
  }, { timezone: TIMEZONE });

  console.log("🕐 Cron jobs scheduled: morning 12:30, evening 20:30");
};
