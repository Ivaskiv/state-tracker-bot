// src/utils/scheduler.js
import cron from "node-cron";
import airtableService from "../services/airtableService.js";
import reflectionService from "../services/reflectionService.js";
import fs from "fs";

const lastSentFile = "./lastSent.json";

const loadLastSent = () => {
  if (!fs.existsSync(lastSentFile)) return {};
  return JSON.parse(fs.readFileSync(lastSentFile, "utf-8"));
};

const saveLastSent = (data) => {
  fs.writeFileSync(lastSentFile, JSON.stringify(data));
};

export const initScheduler = (bot) => {
  let lastSent = loadLastSent();

  const sendQuestions = async (type) => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const key = `${type}-${now.toDateString()}`;

    if (lastSent[key]) return; // вже надсилали сьогодні

    try {
      const activeUsers = await airtableService.getActiveUsers();
      for (const user of activeUsers) {
        await reflectionService.startDailyQuestions(bot, user.TG_id, type);
      }
      console.log(`✅ ${type} питання надіслано ${activeUsers.length} користувачам`);
      lastSent[key] = true;
      saveLastSent(lastSent);
    } catch (error) {
      console.error(`❌ Помилка при надсиланні ${type} питань:`, error.message);
    }
  };

  // 08:00 ранкові
  cron.schedule("50 10 * * *", () => sendQuestions("morning"), { timezone: "Europe/Kiev" });

  // 20:30 вечірні
  cron.schedule("30 20 * * *", () => sendQuestions("evening"), { timezone: "Europe/Kiev" });
};
