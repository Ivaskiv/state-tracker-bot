// src/services/scheduler.js
import { CronJob } from 'cron';
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

const jobs = []; // Зберігаємо всі cron-задачі для очищення

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
    console.log(`[scheduler] 🔔 Нагадування ранкових питань о ${new Date().toLocaleString('uk-UA')}`);
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] 🔔 Нагадування ранкових питань - Знайдено ${users.length} активних користувачів`);

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      await sendReminder(bot, QUESTION_TYPES.MORNING, tgId, name);
      await new Promise((resolve) => setTimeout(resolve, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
  } catch (error) {
    console.error('[sendMorningReminder] Помилка:', error);
  }
};

const sendEveningReminder = async (bot) => {
  try {
    console.log(`[scheduler] 🔔 Нагадування вечірніх питань о ${new Date().toLocaleString('uk-UA')}`);
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] 🔔 Нагадування вечірніх питань - Знайдено ${users.length} активних користувачів`);

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      await sendReminder(bot, QUESTION_TYPES.EVENING, tgId, name);
      await new Promise((resolve) => setTimeout(resolve, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
  } catch (error) {
    console.error('[sendEveningReminder] Помилка:', error);
  }
};

const startSession = async (bot, type, tgId, name) => {
  try {
    const isCompleted = await responseService.isSessionCompleted(tgId, type);
    if (isCompleted) return;

    const currentTime = getUserDateTime(tgId);
    const currentHour = currentTime.getHours();
    const isMorning = type === QUESTION_TYPES.MORNING;
    const startHour = isMorning ? SCHEDULE.MORNING_START : SCHEDULE.EVENING_START;
    const endHour = isMorning ? SCHEDULE.MORNING_END : SCHEDULE.EVENING_END;

    if (currentHour < startHour || currentHour >= endHour) {
      console.log(`[startSession] Пропущено ${type} для ${tgId}: поза часовим вікном`);
      return;
    }

    const message = isMorning
      ? SCHEDULER_MESSAGES.MORNING_SESSION_START(name)
      : SCHEDULER_MESSAGES.EVENING_SESSION_START(name);
    const step = isMorning ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;

    await userService.updateUserStep(tgId, step);
    await bot.telegram.sendMessage(tgId, message);
    console.log(`[startSession] Початок ${type} сесії для ${tgId}`);
  } catch (error) {
    console.error(`[startSession] Помилка для ${type}, користувач ${tgId}:`, error);
  }
};

const startScheduler = (bot) => {
  // Очищаємо попередні задачі
  console.log(`[scheduler] Clearing ${jobs.length} existing cron jobs...`);
  while (jobs.length > 0) {
    const job = jobs.pop();
    job.stop();
  }

  // Нагадування ранкових питань
  jobs.push(
    new CronJob(
      CRON_SCHEDULES.MORNING_REMINDER,
      () => sendMorningReminder(bot),
      null,
      true,
      SCHEDULE.TIMEZONE
    )
  );

  // Нагадування вечірніх питань
  jobs.push(
    new CronJob(
      CRON_SCHEDULES.EVENING_REMINDER,
      () => sendEveningReminder(bot),
      null,
      true,
      SCHEDULE.TIMEZONE
    )
  );

  // Початок ранкових сесій
  jobs.push(
    new CronJob(
      CRON_SCHEDULES.MORNING_QUESTIONS,
      async () => {
        try {
          console.log(`[scheduler] 🌞 Початок ранкових сесій о ${new Date().toLocaleString('uk-UA')}`);
          const users = await userService.getActiveUsers();
          console.log(`[scheduler] 🌞 Знайдено ${users.length} активних користувачів`);

          for (const user of users) {
            const tgId = user['TG_id'];
            const name = user['User Name'] || 'Користувач';
            await startSession(bot, QUESTION_TYPES.MORNING, tgId, name);
            await new Promise((resolve) => setTimeout(resolve, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
        } catch (error) {
          console.error('[scheduler] Помилка ранкових сесій:', error);
        }
      },
      null,
      true,
      SCHEDULE.TIMEZONE
    )
  );

  // Початок вечірніх сесій
  jobs.push(
    new CronJob(
      CRON_SCHEDULES.EVENING_QUESTIONS,
      async () => {
        try {
          console.log(`[scheduler] 🌙 Початок вечірніх сесій о ${new Date().toLocaleString('uk-UA')}`);
          const users = await userService.getActiveUsers();
          console.log(`[scheduler] 🌙 Знайдено ${users.length} активних користувачів`);

          for (const user of users) {
            const tgId = user['TG_id'];
            const name = user['User Name'] || 'Користувач';
            await startSession(bot, QUESTION_TYPES.EVENING, tgId, name);
            await new Promise((resolve) => setTimeout(resolve, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
        } catch (error) {
          console.error('[scheduler] Помилка вечірніх сесій:', error);
        }
      },
      null,
      true,
      SCHEDULE.TIMEZONE
    )
  );

  console.log(`[scheduler] Планувальник запущено, ${jobs.length} cron jobs initialized`);
};

export default { startScheduler };