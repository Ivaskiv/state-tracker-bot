// src/utils/scheduler.js
import cron from "node-cron";
import { bot } from "../../server.js";

import AirtableService from "../services/airtableService.js";
import reflectionService from "../services/reflectionService.js";

export const initScheduler = () => {
  // 08:00 ранкові
  cron.schedule("0 8 * * *", async () => {
    console.log("🕗 Надсилання ранкових питань (усім активним користувачам)");
    try {
      const activeUsers = await AirtableService.getActiveUsers();
      for (const user of activeUsers) {
        const tgId = user.TG_id;
        console.log(`Надсилаю ранкові питання користувачу ${tgId}`);
        await reflectionService.startDailyQuestions(bot, tgId, "morning");
      }
      console.log(`✅ Ранкові питання надіслано ${activeUsers.length} користувачам`);
    } catch (error) {
      console.error("❌ Помилка при надсиланні ранкових питань:", error.message);
    }
  }, { timezone: "Europe/Kiev" });

  // 22:00 вечірні
  cron.schedule("10 22 * * *", async () => {
    console.log("🕣 Надсилання вечірніх питань (усім активним користувачам)");
    try {
      const activeUsers = await AirtableService.getActiveUsers();
      for (const user of activeUsers) {
        const tgId = user.TG_id;
        console.log(`Надсилаю вечірні питання користувачу ${tgId}`);
        await reflectionService.startDailyQuestions(bot, tgId, "evening");
      }
      console.log(`✅ Вечірні питання надіслано ${activeUsers.length} користувачам`);
    } catch (error) {
      console.error("❌ Помилка при надсиланні вечірніх питань:", error.message);
    }
  }, { timezone: "Europe/Kiev" });
};