// src/utils/scheduler.js
import cron from "node-cron";
import userService from "../services/userService.js";
import reflectionService from "../services/reflectionService.js";

const TIMEZONE = "Europe/Kiev";

const sendQuestionToUsers = async (bot, type) => {
  try {
    console.log(`[CRON] Старт обробки ${type} питань о ${new Date().toLocaleString("uk-UA")}`);

    const activeUsers = await userService.getActiveUsers();
    console.log(`[CRON] Активних користувачів знайдено: ${activeUsers.length}`);

    for (const user of activeUsers) {
      console.log(`[CRON] Перевіряю користувача TG_id=${user.TG_id}`);

      const alreadyAnswered = await reflectionService.alreadyAnsweredToday(user.TG_id, type);
      console.log(`[CRON] Користувач ${user.TG_id} вже відповів (${type}) сьогодні? → ${alreadyAnswered}`);

      if (!alreadyAnswered) {
        console.log(`[CRON] Надсилаю ${type} питання користувачу ${user.TG_id}`);
        await reflectionService.startDailyQuestions(bot, user.TG_id, type);
      }
    }

    console.log(`✅ ${type} питання надіслано всім активним користувачам`);
  } catch (error) {
    console.error(`❌ Помилка в ${type} питаннях:`, error);
  }
};

export const initScheduler = (bot) => {
  console.log("⏰ Scheduler initialized");

  // Тест кожні 2 хв
  cron.schedule("*/2 * * * *", async () => {
    console.log(`[CRON TEST] Тригер (кожні 2 хв) о ${new Date().toLocaleString("uk-UA")}`);
    await sendQuestionToUsers(bot, "morning");
  }, { timezone: TIMEZONE });

  // Ранкове питання 12:30
  cron.schedule("30 12 * * *", async () => {
    console.log(`[CRON] Тригер ранкових питань (12:30)`);
    await sendQuestionToUsers(bot, "morning");
  }, { timezone: TIMEZONE });

  // Вечірнє питання 20:30
  cron.schedule("30 20 * * *", async () => {
    console.log(`[CRON] Тригер вечірніх питань (20:30)`);
    await sendQuestionToUsers(bot, "evening");
  }, { timezone: TIMEZONE });

  console.log("🕐 Cron jobs scheduled: morning 12:30, evening 20:30, + тест кожні 2 хв");
};
