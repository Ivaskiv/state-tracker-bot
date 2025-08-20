// src/services/schedulerService.js
import cron from 'node-cron';
import userService from './userService.js';
import reflectionService from './reflectionService.js';
import reportService from './reportService.js';

function isLastDayOfMonth(d = new Date()) {
  const test = new Date(d.getFullYear(), d.getMonth() + 1, 0); // останній день
  return d.getDate() === test.getDate();
}

export default async function schedulerService(bot) {
  console.log('🕒 Setting up scheduler...');

  // Morning questions at 08:00 Europe/Kyiv
  cron.schedule('0 8 * * *', async () => {
    const users = await userService.getActiveUsers();
    for (const u of users) {
      try {
        const already = await reflectionService.alreadyAnsweredToday(u.tgId, 'morning');
        if (!already) {
          await reflectionService.startDailyQuestions(bot, u.tgId, 'morning');
        }
      } catch (e) {
        console.error('Morning send error:', u.tgId, e?.message);
      }
    }
  }, { timezone: 'Europe/Kyiv' });

  // Evening questions at 20:30 Europe/Kyiv
  cron.schedule('30 20 * * *', async () => {
    const users = await userService.getActiveUsers();
    for (const u of users) {
      try {
        const already = await reflectionService.alreadyAnsweredToday(u.tgId, 'evening');
        if (!already) {
          await reflectionService.startDailyQuestions(bot, u.tgId, 'evening');
        }
      } catch (e) {
        console.error('Evening send error:', u.tgId, e?.message);
      }
    }
  }, { timezone: 'Europe/Kyiv' });

  // Weekly report Sunday 21:00 Europe/Kyiv
  cron.schedule('0 21 * * 0', async () => {
    const users = await userService.getActiveUsers();
    for (const u of users) {
      try {
        const report = await reportService.generateWeeklyReport(u.tgId);
        await bot.telegram.sendMessage(u.tgId, report);
      } catch (e) {
        console.error('Weekly report error:', u.tgId, e?.message);
      }
    }
  }, { timezone: 'Europe/Kyiv' });

  // Monthly report: every day 22:00, send only if last day of month
  cron.schedule('0 22 * * *', async () => {
    if (!isLastDayOfMonth()) return;
    const users = await userService.getActiveUsers();
    for (const u of users) {
      try {
        const report = await reportService.generateMonthlyReport(u.tgId);
        await bot.telegram.sendMessage(u.tgId, report);
      } catch (e) {
        console.error('Monthly report error:', u.tgId, e?.message);
      }
    }
  }, { timezone: 'Europe/Kyiv' });

  console.log('✅ Started job: morning');
  console.log('✅ Started job: evening');
  console.log('✅ Started job: weekly');
  console.log('✅ Started job: monthly');
}
