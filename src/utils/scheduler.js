// src/utils/scheduler.js
import cron from 'node-cron';
import { getActiveUsers } from './airtable.js';
import { config } from '../config/config.js';
import { generateWeeklyReport, generateMonthlyReport } from './reports.js';

// Зберігаємо всі заплановані завдання
export const scheduledTasks = [];

// Допоміжна функція для безпечної відправки повідомлень
async function safeSend(bot, tgId, message) {
  if (!tgId || !message) return;
  try {
    await bot.telegram.sendMessage(tgId, message);
  } catch (err) {
    console.error(`Message error for ${tgId}:`, err);
  }
}

// Ініціалізація планувальника
export async function initScheduler(bot) {
  console.log('🗓️ Scheduler initializing...');

  // ===== Ранкові повідомлення о 08:00 =====
  scheduledTasks.push(
    cron.schedule('0 8 * * *', async () => {
      const users = await getActiveUsers();
      for (const u of users) {
        if (!u.fields.Paid) continue;
        await safeSend(bot, u.fields.TG_id, config.messages.morningIntro);
      }
    })
  );

  // ===== Вечірні повідомлення о 20:30 =====
  scheduledTasks.push(
    cron.schedule('30 20 * * *', async () => {
      const users = await getActiveUsers();
      for (const u of users) {
        if (!u.fields.Paid) continue;
        await safeSend(bot, u.fields.TG_id, config.messages.eveningIntro);
      }
    })
  );

  // ===== Щотижневий звіт: щонеділі о 21:00 =====
  scheduledTasks.push(
    cron.schedule('0 21 * * 0', async () => {
      const users = await getActiveUsers();
      for (const u of users) {
        if (!u.fields.Paid) continue;
        const report = await generateWeeklyReport(u.fields.TG_id);
        await safeSend(bot, u.fields.TG_id, `📊 Щотижневий звіт:\n${report}`);
      }
    })
  );

  // ===== Щомісячний звіт: останній день місяця о 21:00 =====
  scheduledTasks.push(
    cron.schedule('0 21 28-31 * *', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (tomorrow.getMonth() !== today.getMonth()) {
        const users = await getActiveUsers();
        for (const u of users) {
          if (!u.fields.Paid) continue;
          const report = await generateMonthlyReport(u.fields.TG_id);
          await safeSend(bot, u.fields.TG_id, `📅 Щомісячний звіт:\n${report}`);
        }
      }
    })
  );

  console.log('🗓️ Scheduler initialized');
}
