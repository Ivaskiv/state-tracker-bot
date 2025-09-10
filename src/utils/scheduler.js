// src/utils/scheduler.js
import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import responseService from '../dialogue/services/responseService.js';
import subscriptionReminderService from '../services/subscriptionReminderService.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';
import { schedulePendingReminders } from '../middleware/pendingFlow.js';
import {
  CRON_SCHEDULES,
  SCHEDULER_MESSAGES,
  QUESTION_TYPES,
  ANSWER_STEPS,
  SCHEDULE,
  SCHEDULER_CONFIG,
  SUBSCRIPTION_REMINDER_OFFSETS,
} from '../config/constants.js';

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

// Функція перевірки підписок
const checkSubscriptions = async (bot) => {
  try {
    console.log('[scheduler] 📅 Перевірка підписок на закінчення');
    
    // Перевіряємо кожен offset (-3, -1, 0 днів)
    for (const offset of SUBSCRIPTION_REMINDER_OFFSETS) {
      await subscriptionReminderService.checkAndSendReminders(bot, offset);
      await new Promise(r => setTimeout(r, 1000)); // затримка між офсетами
    }
    
    // Деактивуємо закінчені підписки
    await subscriptionReminderService.deactivateExpiredSubscriptions();
    
  } catch (error) {
    console.error('[scheduler] Помилка перевірки підписок:', error);
  }
};

const startScheduler = (bot) => {
  // зупиняємо попередні задачі
  while (jobs.length) {
    try {
      jobs.pop().stop();
    } catch {}
  }

  console.log('[scheduler] 🚀 Створюємо cron задачі...');
  console.log(`[scheduler] MORNING_QUESTIONS: "${CRON_SCHEDULES.MORNING_QUESTIONS}"`);
  console.log(`[scheduler] EVENING_QUESTIONS: "${CRON_SCHEDULES.EVENING_QUESTIONS}"`);

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
  console.log(`[scheduler] 📅 Налаштовуємо ранкові сесії на "${CRON_SCHEDULES.MORNING_QUESTIONS}"`);
  jobs.push(
    cron.schedule(
      CRON_SCHEDULES.MORNING_QUESTIONS,
      async () => {
        try {
          console.log(
            `[scheduler] 🌞 ЗАПУСК РАНКОВИХ СЕСІЙ о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
          );
          const users = await userService.getActiveUsers();
          console.log(`[scheduler] 🌞 Активних користувачів: ${users.length}`);

          if (users.length === 0) {
            console.log('[scheduler] 🌞 Немає активних користувачів для ранкових питань');
            return;
          }

          for (const user of users) {
            const tgId = user['TG_id'];
            const name = user['User Name'] || 'Користувач';
            
            console.log(`[scheduler] 🌞 Обробляємо користувача ${tgId} (${name})`);
            await startSession(bot, QUESTION_TYPES.MORNING, tgId, name);
            await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
          
          console.log('[scheduler] 🌞 Ранкові сесії завершено');
        } catch (error) {
          console.error('[scheduler] ❌ Помилка ранкових сесій:', error);
        }
      },
      { 
        timezone: SCHEDULE.TIMEZONE,
        scheduled: true
      }
    )
  );

  // Початок вечірніх сесій
  console.log(`[scheduler] 📅 Налаштовуємо вечірні сесії на "${CRON_SCHEDULES.EVENING_QUESTIONS}"`);
  jobs.push(
    cron.schedule(
      CRON_SCHEDULES.EVENING_QUESTIONS,
      async () => {
        try {
          console.log(
            `[scheduler] 🌙 ЗАПУСК ВЕЧІРНІХ СЕСІЙ о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`
          );
          const users = await userService.getActiveUsers();
          console.log(`[scheduler] 🌙 Активних користувачів: ${users.length}`);

          if (users.length === 0) {
            console.log('[scheduler] 🌙 Немає активних користувачів для вечірніх питань');
            return;
          }

          for (const user of users) {
            const tgId = user['TG_id'];
            const name = user['User Name'] || 'Користувач';
            
            console.log(`[scheduler] 🌙 Обробляємо користувача ${tgId} (${name})`);
            await startSession(bot, QUESTION_TYPES.EVENING, tgId, name);
            await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
          
          console.log('[scheduler] 🌙 Вечірні сесії завершено');
        } catch (error) {
          console.error('[scheduler] ❌ Помилка вечірніх сесій:', error);
        }
      },
      { 
        timezone: SCHEDULE.TIMEZONE,
        scheduled: true
      }
    )
  );

  // Перевірка підписок щодня о 10:00
  jobs.push(
    cron.schedule(
      CRON_SCHEDULES.SUBSCRIPTION_CHECK,
      () => checkSubscriptions(bot),
      { timezone: SCHEDULE.TIMEZONE }
    )
  );

  // Нагадування про звіти
  jobs.push(
    cron.schedule(
      CRON_SCHEDULES.REPORTS_REMINDER,
      async () => {
        try {
          console.log('[scheduler] 📊 Нагадування про звіти');
          const users = await userService.getActiveUsers();
          
          for (const user of users) {
            const tgId = user['TG_id'];
            await bot.telegram.sendMessage(tgId, SCHEDULER_MESSAGES.REPORTS_REMINDER);
            await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
          }
        } catch (error) {
          console.error('[scheduler] Помилка нагадувань про звіти:', error);
        }
      },
      { timezone: SCHEDULE.TIMEZONE }
    )
  );

  console.log('[scheduler] ✅ Планувальник запущено з усіма задачами:');
  console.log(`- Ранкові сесії: ${SCHEDULE.MORNING_TIME} (${CRON_SCHEDULES.MORNING_QUESTIONS})`);
  console.log(`- Вечірні сесії: ${SCHEDULE.EVENING_TIME} (${CRON_SCHEDULES.EVENING_QUESTIONS})`);
  console.log(`- Ранкові нагадування: +10 хв (${CRON_SCHEDULES.MORNING_REMINDER})`);
  console.log(`- Вечірні нагадування: +10 хв (${CRON_SCHEDULES.EVENING_REMINDER})`);
  console.log(`- Перевірка підписок: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);
  console.log(`- Нагадування про звіти: ${CRON_SCHEDULES.REPORTS_REMINDER}`);
  console.log(`- Часова зона: ${SCHEDULE.TIMEZONE}`);
  console.log(`- Поточний час: ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
};


export { startScheduler };