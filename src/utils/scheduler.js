// src/utils/scheduler.js
import cron from 'node-cron';
import userService from '../services/userService.js';
import reminderService from '../services/reminderService.js';
import { SCHEDULE, REPORT_SCHEDULE, ANSWER_STEPS } from '../config/constants.js';

// Ініціалізація планувальника
export const initScheduler = (bot) => {
  console.log('[scheduler] ⏰ Планувальник ініціалізовано');

  // Надсилання повідомлень активним користувачам
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
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.MORNING_1);
      await reminderService.sendNextQuestion(bot, { ...user, Answer_Step: ANSWER_STEPS.MORNING_1 });
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Вечірні питання (20:30)
  const [eveningHour, eveningMinute] = SCHEDULE.EVENING_TIME.split(':').map(Number);
  cron.schedule(`${eveningMinute} ${eveningHour} * * *`, () => {
    const logPrefix = '🌙 Надсилання вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(async (user) => {
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.EVENING_1);
      await reminderService.sendNextQuestion(bot, { ...user, Answer_Step: ANSWER_STEPS.EVENING_1 });
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Щотижневий звіт (неділя, 19:00)
  const { dayOfWeek, hour: weeklyHour, minute: weeklyMinute, message: weeklyMessage } = REPORT_SCHEDULE.WEEKLY;
  cron.schedule(`${weeklyMinute} ${weeklyHour} * * ${dayOfWeek}`, () => {
    const logPrefix = '📊 Надсилання щотижневих звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(async (user) => {
      await bot.telegram.sendChatAction(user.TG_id, 'typing');
      await new Promise(res => setTimeout(res, 1500));
      await bot.telegram.sendMessage(user.TG_id, weeklyMessage);
      console.log(`[scheduler] Надіслано щотижневий звіт користувачу ${user.TG_id}`);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Місячний звіт (1-е, 12:00)
  const { dayRange, hour: monthlyHour, minute: monthlyMinute, message: monthlyMessage } = REPORT_SCHEDULE.MONTHLY;
  cron.schedule(`${monthlyMinute} ${monthlyHour} ${dayRange.join(',')} * *`, () => {
    const logPrefix = '📊 Надсилання місячних звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(async (user) => {
      await bot.telegram.sendChatAction(user.TG_id, 'typing');
      await new Promise(res => setTimeout(res, 1500));
      await bot.telegram.sendMessage(user.TG_id, monthlyMessage);
      console.log(`[scheduler] Надіслано місячний звіт користувачу ${user.TG_id}`);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Логи ініціалізації
  console.log(`[scheduler] Ранкові питання заплановано на ${SCHEDULE.MORNING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] Вечірні питання заплановано на ${SCHEDULE.EVENING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] Щотижневі звіти заплановано на неділю ${REPORT_SCHEDULE.WEEKLY.hour}:${REPORT_SCHEDULE.WEEKLY.minute} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] Місячні звіти заплановано на 1-е ${REPORT_SCHEDULE.MONTHLY.hour}:${REPORT_SCHEDULE.MONTHLY.minute} (${SCHEDULE.TIMEZONE})`);
};