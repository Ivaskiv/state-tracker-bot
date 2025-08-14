// src/utils/scheduler.js
import cron from 'node-cron';
import { config } from '../config/config.js';
import { getActiveUsers } from '../utils/airtable.js';
import { generateWeeklyReport } from '../utils/reports.js';

// Зберігаємо завдання для можливості скасування / оновлення
const scheduledTasks = [];

// Ініціалізація планувальника
export async function initScheduler(bot) {
  console.log('🗓️ Scheduler initializing...');

  // Ранкові повідомлення (08:00)
  scheduledTasks.push(
    cron.schedule('0 8 * * *', async () => {
      const users = await getActiveUsers();
      for (const user of users) {
        if (!user.fields.Paid) continue;
        try {
          await bot.telegram.sendMessage(user.fields.TG_id, config.morningMessage);
        } catch (err) {
          console.error('Error sending morning message:', err, user.fields.TG_id);
        }
      }
    })
  );

  // Вечірні повідомлення (20:30)
  scheduledTasks.push(
    cron.schedule('30 20 * * *', async () => {
      const users = await getActiveUsers();
      for (const user of users) {
        if (!user.fields.Paid) continue;
        try {
          await bot.telegram.sendMessage(user.fields.TG_id, config.eveningMessage);
        } catch (err) {
          console.error('Error sending evening message:', err, user.fields.TG_id);
        }
      }
    })
  );

  // Щотижневий звіт (неділя, 19:00)
  scheduledTasks.push(
    cron.schedule('0 19 * * 0', async () => {
      const users = await getActiveUsers();
      for (const user of users) {
        if (!user.fields.Paid) continue;
        try {
          const report = await generateWeeklyReport(user.fields.TG_id);
          await bot.telegram.sendMessage(user.fields.TG_id, report);
        } catch (err) {
          console.error('Error sending weekly report:', err, user.fields.TG_id);
        }
      }
    })
  );

  // Щомісячний звіт (1-го числа, 12:00)
  scheduledTasks.push(
    cron.schedule('0 12 1 * *', async () => {
      const users = await getActiveUsers();
      for (const user of users) {
        if (!user.fields.Paid) continue;
        try {
          const report = await generateMonthlyReport(user.fields.TG_id);
          await bot.telegram.sendMessage(user.fields.TG_id, report);
        } catch (err) {
          console.error('Error sending monthly report:', err, user.fields.TG_id);
        }
      }
    })
  );

  console.log('🗓️ Scheduler initialized');
}

// Налаштування індивідуального розкладу користувача (наприклад, додаткові нагадування)
export async function setupUserSchedule(bot, { telegramId, schedule }) {
  let cronTime;

  switch(schedule) {
    case 'Once':
      cronTime = '0 9 * * *';
      break;
    case 'Twice':
      cronTime = '0 9,18 * * *';
      break;
    case 'ThreeTimes':
      cronTime = '0 9,15,18 * * *';
      break;
    case 'FourTimes':
      cronTime = '0 9,12,15,18 * * *';
      break;
    case 'Hourly':
      cronTime = '0 * * * *';
      break;
    default:
      return;
  }

  const task = cron.schedule(cronTime, async () => {
    try {
      // Перед відправкою перевіряємо, чи користувач активний і оплатив
      const users = await getActiveUsers();
      const user = users.find(u => u.fields.TG_id === telegramId.toString());
      if (!user || !user.fields.Paid) return;

      await bot.telegram.sendMessage(telegramId, '🔔 Час на твою сесію фокусу!');
    } catch (error) {
      console.error(`Error sending scheduled message to ${telegramId}:`, error);
    }
  });

  scheduledTasks.push(task);
}
