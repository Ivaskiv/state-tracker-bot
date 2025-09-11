// src/services/scheduler.js
import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import responseService from '../dialogue/services/responseService.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';
import {
  CRON_SCHEDULES,
  SCHEDULER_MESSAGES,
  QUESTION_TYPES,
  ANSWER_STEPS,
  SCHEDULE,
  SCHEDULER_CONFIG,
} from '../config/constants.js';
import { schedulePendingReminders } from '../middleware/pendingFlow.js';
import wheelBalanceController from '../controllers/wheelBalanceController.js';

const jobs = []; // зберігаємо усі задачі для подальшого stop()

const sendReminder = async (bot, type, tgId, name) => {
  try {
    const isCompleted = await responseService.isSessionCompleted(tgId, type);
    if (isCompleted) return;

    const message =
      type === QUESTION_TYPES.MORNING
        ? SCHEDULER_MESSAGES.MORNING_REMINDER
        : SCHEDULER_MESSAGES.EVENING_REMINDER;

    await bot.telegram.sendMessage(tgId, message);
    console.log(`[sendReminder] Надіслано нагадування для ${type} користувачу ${tgId}`);
  } catch (error) {
    console.error(`[sendReminder] Помилка для ${type}, користувач ${tgId}:`, error);
  }
};

const sendMorningReminder = async (bot) => {
  try {
    console.log(
      `[scheduler] 🔔 Нагадування ранкових питань о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
    );
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] 🔔 Ранкові нагадування — активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      await sendReminder(bot, QUESTION_TYPES.MORNING, tgId, name);
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
  } catch (error) {
    console.error('[sendMorningReminder] Помилка:', error);
  }
};

const sendEveningReminder = async (bot) => {
  try {
    console.log(
      `[scheduler] 🔔 Нагадування вечірніх питань о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
    );
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] 🔔 Вечірні нагадування — активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      await sendReminder(bot, QUESTION_TYPES.EVENING, tgId, name);
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
  } catch (error) {
    console.error('[sendEveningReminder] Помилка:', error);
  }
};

const startSession = async (bot, type, tgId, name) => {
  try {
    const isCompleted = await responseService.isSessionCompleted(tgId, type);
    if (isCompleted) return;

    const now = getUserDateTime(tgId);
    const hour = now.getHours();
    const isMorning = type === QUESTION_TYPES.MORNING;
    const startHour = isMorning ? SCHEDULE.MORNING_START : SCHEDULE.EVENING_START;
    const endHour = isMorning ? SCHEDULE.MORNING_END : SCHEDULE.EVENING_END;

    if (hour < startHour || hour >= endHour) {
      console.log(`[startSession] Пропущено ${type} для ${tgId}: поза часовим вікном`);
      return;
    }

    const message = isMorning
      ? SCHEDULER_MESSAGES.MORNING_SESSION_START(name)
      : SCHEDULER_MESSAGES.EVENING_SESSION_START(name);

    const step = isMorning ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;

    await userService.updateUserStep(tgId, step);
    await bot.telegram.sendMessage(tgId, message);

    // персональні нагадування +10 хв та +60 хв
    schedulePendingReminders(bot, tgId, isMorning ? 'Morning' : 'Evening');

    console.log(`[startSession] Початок ${type} сесії для ${tgId}`);
  } catch (error) {
    console.error(`[startSession] Помилка для ${type}, користувач ${tgId}:`, error);
  }
};

const startScheduler = (bot) => {
  // зупиняємо попередні задачі
  while (jobs.length) {
    try {
      jobs.pop().stop();
    } catch {}
  }

  // Ранкові нагадування
  jobs.push(
    cron.schedule(CRON_SCHEDULES.MORNING_REMINDER, () => sendMorningReminder(bot), {
      timezone: SCHEDULE.TIMEZONE,
    })
  );

  // Вечірні нагадування
  jobs.push(
    cron.schedule(CRON_SCHEDULES.EVENING_REMINDER, () => sendEveningReminder(bot), {
      timezone: SCHEDULE.TIMEZONE,
    })
  );

  // Початок ранкових сесій
  jobs.push(
    cron.schedule(
      CRON_SCHEDULES.MORNING_QUESTIONS,
      async () => {
        try {
          console.log(
            `[scheduler] 🌞 Початок ранкових сесій о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
          );
          const users = await userService.getActiveUsers();
          console.log(`[scheduler] 🌞 Активних користувачів: ${users.length}`);

          for (const user of users) {
            const tgId = user['TG_id'];
            const name = user['User Name'] || 'Користувач';
            await startSession(bot, QUESTION_TYPES.MORNING, tgId, name);
            await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
        } catch (error) {
          console.error('[scheduler] Помилка ранкових сесій:', error);
        }
      },
      { timezone: SCHEDULE.TIMEZONE }
    )
  );

  // Початок вечірніх сесій
  jobs.push(
    cron.schedule(
      CRON_SCHEDULES.EVENING_QUESTIONS,
      async () => {
        try {
          console.log(
            `[scheduler] 🌙 Початок вечірніх сесій о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
          );
          const users = await userService.getActiveUsers();
          console.log(`[scheduler] 🌙 Активних користувачів: ${users.length}`);

          for (const user of users) {
            const tgId = user['TG_id'];
            const name = user['User Name'] || 'Користувач';
            await startSession(bot, QUESTION_TYPES.EVENING, tgId, name);
            await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
        } catch (error) {
          console.error('[scheduler] Помилка вечірніх сесій:', error);
        }
      },
      { timezone: SCHEDULE.TIMEZONE }
    )
  );
// ✅ ДОДАЄМО ЩОМІСЯЧНУ ПЕРЕВІРКУ КОЛЕСА БАЛАНСУ (1 число кожного місяця о 10:00)
  jobs.push(
    cron.schedule(
      '0 10 1 * *', // 1 число кожного місяця о 10:00
      async () => {
        try {
          console.log(
            `[scheduler] 🎯 Щомісячна перевірка колеса балансу о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
          );
          await wheelBalanceController.checkMonthlyWheelNeed(bot);
        } catch (error) {
          console.error('[scheduler] Помилка щомісячної перевірки колеса:', error);
        }
      },
      { timezone: SCHEDULE.TIMEZONE }
    )
  );

  console.log('[scheduler] Планувальник запущено з колесом балансу');
};

// ⬇️ Експорти
export { startScheduler };
export default { startScheduler };
