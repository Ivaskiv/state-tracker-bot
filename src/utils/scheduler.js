// src/utils/scheduler.js
import cron from "node-cron";
import { bot } from "../../server.js";
import airtableService from "../services/airtableService.js";
import reflectionService from "../services/reflectionService.js";

const TIMEZONE = "Europe/Kiev";

const checkAndSendMissedQuestions = async () => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const activeUsers = await airtableService.getActiveUsers();

    for (const user of activeUsers) {
      const tgId = user.TG_id;

      // Перевірка, чи надіслані ранкові питання
      if (!user.morningSent && now.getHours() >= 8) {
        await reflectionService.startDailyQuestions(bot, tgId, "morning");
        console.log(`📩 Надіслано пропущені ранкові питання користувачу ${tgId}`);
      }

      // Перевірка, чи надіслані вечірні питання
      if (!user.eveningSent && now.getHours() >= 20) {
        await reflectionService.startDailyQuestions(bot, tgId, "evening");
        console.log(`📩 Надіслано пропущені вечірні питання користувачу ${tgId}`);
      }
    }
  } catch (err) {
    console.error("❌ Помилка при перевірці пропущених питань:", err.message);
  }
};

export const initScheduler = () => {
  // Перевірка пропущених питань одразу при старті
  checkAndSendMissedQuestions();

  // Ранкові питання о 08:00
  cron.schedule("0 11 * * *", async () => {
    console.log("🕗 Надсилання ранкових питань (усім активним користувачам)");
    try {
      const activeUsers = await airtableService.getActiveUsers();
      for (const user of activeUsers) {
        await reflectionService.startDailyQuestions(bot, user.TG_id, "morning");
      }
      console.log(`✅ Ранкові питання надіслано ${activeUsers.length} користувачам`);
    } catch (error) {
      console.error("❌ Помилка при надсиланні ранкових питань:", error.message);
    }
  }, { timezone: TIMEZONE });

  // Вечірні питання о 20:30
  cron.schedule("30 20 * * *", async () => {
    console.log("🕣 Надсилання вечірніх питань (усім активним користувачам)");
    try {
      const activeUsers = await airtableService.getActiveUsers();
      for (const user of activeUsers) {
        await reflectionService.startDailyQuestions(bot, user.TG_id, "evening");
      }
      console.log(`✅ Вечірні питання надіслано ${activeUsers.length} користувачам`);
    } catch (error) {
      console.error("❌ Помилка при надсиланні вечірніх питань:", error.message);
    }
  }, { timezone: TIMEZONE });
};
