// src/dialogue/utils/scheduler.js
import cron from 'node-cron';
import userService from '../../auth/services/userService.js';
import reminderService from '../services/reminderService.js';
import responseService from '../services/responseService.js';
import analyticsController from '../../controllers/analyticsController.js';
import {
  SCHEDULE,
  REPORT_SCHEDULE,
  ANSWER_STEPS,
  CRON_SCHEDULES,
  SCHEDULER_MESSAGES,
  SCHEDULER_CONFIG,
  QUESTION_TYPES
} from '../../config/constants.js';
import { schedulePendingReminders } from '../middlewares/pendingFlow.js'; // ⬅️ ДОДАНО

// ⚠️ Ініціалізація планувальника
export const initScheduler = (bot) => {
  console.log('[scheduler] ⏰ Планувальник ініціалізовано');

  // ⚠️ Надсилання повідомлень активним користувачам - винесено логіку
  const sendToActiveUsers = async (callback, logPrefix) => {
    try {
      const users = await userService.getAllUsers();
      const activeUsers = users.filter(u => u['Active_Subscription_Status']?.includes('✅ Активна'));
      console.log(`[scheduler] ${logPrefix} - Знайдено ${activeUsers.length} активних користувачів`);

      for (const user of activeUsers) {
        try {
          await callback(user);
          await new Promise(resolve => setTimeout(resolve, SCHEDULER_CONFIG.USER_DELAY_MS));
        } catch (err) {
          console.error(`[scheduler] ${logPrefix} - Помилка для користувача ${user.TG_id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[scheduler] ${logPrefix} - Помилка отримання користувачів:`, err);
    }
  };

  // ⚠️ Ранкові питання - використовуємо CRON_SCHEDULES
  cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, () => {
    const logPrefix = '🌞 Надсилання ранкових питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      // 1) Стартуємо сесію з кроку 1
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.MORNING_1);
      // 2) Відправляємо перше питання (твій існуючий сервіс)
      await reminderService.startMorningSession(bot, user);
      // 3) Персональні нагадування +10 хв та +60 хв (якщо не відповідає)
      schedulePendingReminders(bot, user.TG_id, 'Morning');
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Вечірні питання - використовуємо CRON_SCHEDULES
  cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, () => {
    const logPrefix = '🌙 Надсилання вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.EVENING_1);
      await reminderService.startEveningSession(bot, user);
      schedulePendingReminders(bot, user.TG_id, 'Evening');
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Щотижневий звіт - використовуємо REPORT_SCHEDULE
  const { dayOfWeek, hour: weeklyHour, minute: weeklyMinute } = REPORT_SCHEDULE.WEEKLY;
  cron.schedule(`${weeklyMinute} ${weeklyHour} * * ${dayOfWeek}`, () => {
    const logPrefix = '📊 Надсилання щотижневих звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      try {
        const report = await analyticsController.generateWeeklyReportForUser(user.TG_id);
        if (report) {
          await bot.telegram.sendMessage(user.TG_id, SCHEDULER_MESSAGES.WEEKLY_REPORT_READY);
          await new Promise(resolve => setTimeout(resolve, SCHEDULER_CONFIG.REPORT_DELAY_MS));
          await bot.telegram.sendMessage(user.TG_id, report);
          console.log(`[scheduler] ✅ Надіслано щотижневий звіт користувачу ${user.TG_id}`);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка генерації щотижневого звіту для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Місячний звіт - використовуємо REPORT_SCHEDULE
  const { dayRange, hour: monthlyHour, minute: monthlyMinute } = REPORT_SCHEDULE.MONTHLY;
  cron.schedule(`${monthlyMinute} ${monthlyHour} ${dayRange.join(',')} * *`, () => {
    const logPrefix = '📈 Надсилання місячних звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      try {
        const report = await analyticsController.generateMonthlyReportForUser(user.TG_id);
        if (report) {
          await bot.telegram.sendMessage(user.TG_id, SCHEDULER_MESSAGES.MONTHLY_REPORT_READY);
          await new Promise(resolve => setTimeout(resolve, SCHEDULER_CONFIG.REPORT_DELAY_MS));
          await bot.telegram.sendMessage(user.TG_id, report);
          console.log(`[scheduler] ✅ Надіслано місячний звіт користувачу ${user.TG_id}`);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка генерації місячного звіту для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Нагадування ранкових (глобальні) — дублюючих спамів не буде завдяки перевіркам
  cron.schedule(CRON_SCHEDULES.MORNING_REMINDER, () => {
    const logPrefix = '🔔 Нагадування ранкових питань (глобальне)';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      try {
        const isCompleted = await responseService.isSessionCompleted(user.TG_id, QUESTION_TYPES.MORNING);
        const isInProgress = !!(user.Answer_Step && user.Answer_Step.startsWith('Q_m_'));
        // Якщо сесія вже йде — персональні таймери з pendingFlow нагадають. Тут шлемо лише тим, хто ще НЕ стартував.
        if (!isCompleted && !isInProgress) {
          await reminderService.sendReminder(bot, user.TG_id, QUESTION_TYPES.MORNING);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Нагадування вечірніх (глобальні)
  cron.schedule(CRON_SCHEDULES.EVENING_REMINDER, () => {
    const logPrefix = '🔔 Нагадування вечірніх питань (глобальне)';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      try {
        const isCompleted = await responseService.isSessionCompleted(user.TG_id, QUESTION_TYPES.EVENING);
        const isInProgress = !!(user.Answer_Step && user.Answer_Step.startsWith('Q_e_'));
        if (!isCompleted && !isInProgress) {
          await reminderService.sendReminder(bot, user.TG_id, QUESTION_TYPES.EVENING);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Нагадування про звіти - використовуємо CRON_SCHEDULES
  cron.schedule(CRON_SCHEDULES.REPORTS_REMINDER, () => {
    const logPrefix = '💡 Нагадування про звіти';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      try {
        const recentRecords = await responseService.getUserRecords(user.TG_id, SCHEDULER_CONFIG.RECENT_RECORDS_DAYS);
        if (recentRecords.length >= SCHEDULER_CONFIG.MIN_RECORDS_FOR_REMINDER) {
          await bot.telegram.sendMessage(user.TG_id, SCHEDULER_MESSAGES.REPORTS_REMINDER);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування про звіти для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Перевірка підписок - використовуємо CRON_SCHEDULES
  cron.schedule(CRON_SCHEDULES.SUBSCRIPTION_CHECK, () => {
    const logPrefix = '🔄 Перевірка підписок';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);

    sendToActiveUsers(async (user) => {
      try {
        await userService.checkSubscriptionStatus(user.TG_id);
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка перевірки підписки для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Логи ініціалізації - використовуємо константи
  console.log(`[scheduler] ✅ Ранкові питання заплановано на ${SCHEDULE.MORNING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Вечірні питання заплановано на ${SCHEDULE.EVENING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Щотижневі звіти: неділя ${REPORT_SCHEDULE.WEEKLY.hour}:${REPORT_SCHEDULE.WEEKLY.minute.toString().padStart(2, '0')} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Місячні звіти: кінець місяця ${REPORT_SCHEDULE.MONTHLY.hour}:${REPORT_SCHEDULE.MONTHLY.minute.toString().padStart(2, '0')} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Нагадування ранкових питань: ${CRON_SCHEDULES.MORNING_REMINDER}`);
  console.log(`[scheduler] ✅ Нагадування вечірніх питань: ${CRON_SCHEDULES.EVENING_REMINDER}`);
  console.log(`[scheduler] ✅ Нагадування про звіти: ${CRON_SCHEDULES.REPORTS_REMINDER}`);
  console.log(`[scheduler] ✅ Перевірка підписок: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);
};
