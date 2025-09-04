// src/services/schedulerService.js
import cron from 'node-cron';
import userService from './userService.js';
import reminderService from './reminderService.js';
import { SCHEDULE, REPORT_SCHEDULE, QUESTION_TYPES } from '../../config/constants.js';

const setupScheduler = (bot) => {
  console.log("[scheduler] ⏰ Scheduler initialized");

  const sendToActiveUsers = async (callback, logPrefix) => {
    try {
      const users = await userService.getAllUsers();
      const activeUsers = users.filter(u => u['Active_Subscription_Status']?.includes('✅ Активна'));
      console.log(`[scheduler] ${logPrefix} - Знайдено ${activeUsers.length} активних користувачів`);
      for (const user of activeUsers) {
        try {
          await callback(user);
        } catch (err) {
          console.error(`[scheduler] ${logPrefix} - Помилка для користувача ${user.TG_id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[scheduler] ${logPrefix} - Помилка отримання користувачів:`, err);
    }
  };

  // Ранкові питання (08:00)
  const [morningHour, morningMinute] = SCHEDULE.MORNING_TIME.split(':').map(Number);
  cron.schedule(`${morningMinute} ${morningHour} * * *`, () => {
    const logPrefix = '🚀 Надсилання ранкових питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(async (user) => {
      await reminderService.startMorningSession(bot, user);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Вечірні питання (20:30)
  const [eveningHour, eveningMinute] = SCHEDULE.EVENING_TIME.split(':').map(Number);
  cron.schedule(`${eveningMinute} ${eveningHour} * * *`, () => {
    const logPrefix = '🌙 Надсилання вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(async (user) => {
      await reminderService.startEveningSession(bot, user);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Логи ініціалізації
  console.log(`[scheduler] Morning questions scheduled for ${SCHEDULE.MORNING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] Evening questions scheduled for ${SCHEDULE.EVENING_TIME} (${SCHEDULE.TIMEZONE})`);
};

export default { setupScheduler };