// src/services/scheduler.js
// Планувальник для автоматичних нагадувань (fix: правильні поля Users: TG_id, "User Name")

import cron from 'node-cron';
import { CRON_SCHEDULES, SCHEDULER_MESSAGES } from '../config/constants.js';
import { tables, selectFromTable } from '../config/database.js';

let jobs = [];

/**
 * Отримати активних користувачів
 * Умови: Status = 'Active User' і Answer_Step = 'COMPLETED'
 */
const getActiveUsers = async () => {
  try {
    const formula = `AND({Status} = 'Active User', {Answer_Step} = 'COMPLETED')`;
    const records = await selectFromTable(tables.USERS, { filterByFormula: formula }).all();
    return records || [];
  } catch (error) {
    console.error('[scheduler/getActiveUsers] ❌ Помилка:', error);
    return [];
  }
};

/** Безпечне отримання TG chat_id з запису Users */
const getChatId = (user) => {
  const tg = user?.fields?.TG_id;
  if (!tg) return null;
  return String(tg).trim();
};

/** Безпечне імʼя для звертання */
const getUserName = (user) => {
  return user?.fields?.['User Name'] || 'Користувач';
};

/**
 * Відправити ранкові питання
 */
const sendMorningQuestions = async (bot) => {
  console.log('🌞 [scheduler] Відправка ранкових питань...');
  try {
    const users = await getActiveUsers();
    console.log(`[scheduler] Знайдено активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = getChatId(user);
      if (!tgId) {
        console.error('[scheduler] ❌ Пропущено: chat_id порожній (TG_id відсутній)');
        continue;
      }

      const userName = getUserName(user);

      try {
        await bot.telegram.sendMessage(
          tgId,
          SCHEDULER_MESSAGES.MORNING_SESSION_START(userName),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌞 Почати ранкову рефлексію', callback_data: 'start_morning' }],
                [{ text: '⏭ Пізніше', callback_data: 'later_morning' }]
              ]
            }
          }
        );
        console.log(`[scheduler] ✅ Ранкові надіслані для TG=${tgId}`);
      } catch (err) {
        console.error(`[scheduler] ❌ Помилка відправки ранкових TG=${tgId}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[scheduler/sendMorningQuestions] ❌ Помилка:', error);
  }
};

/**
 * Відправити вечірні питання
 */
const sendEveningQuestions = async (bot) => {
  console.log('🌙 [scheduler] Відправка вечірніх питань...');
  try {
    const users = await getActiveUsers();
    console.log(`[scheduler] Знайдено активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = getChatId(user);
      if (!tgId) {
        console.error('[scheduler] ❌ Пропущено: chat_id порожній (TG_id відсутній)');
        continue;
      }

      const userName = getUserName(user);

      try {
        await bot.telegram.sendMessage(
          tgId,
          SCHEDULER_MESSAGES.EVENING_SESSION_START(userName),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }],
                [{ text: '⏭ Пізніше', callback_data: 'later_evening' }]
              ]
            }
          }
        );
        console.log(`[scheduler] ✅ Вечірні надіслані для TG=${tgId}`);
      } catch (err) {
        console.error(`[scheduler] ❌ Помилка відправки вечірніх TG=${tgId}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[scheduler/sendEveningQuestions] ❌ Помилка:', error);
  }
};

/**
 * Перевірка підписок (заглушка, підʼєднаєш коли буде готово)
 */
const checkSubscriptions = async (_bot) => {
  console.log('💰 [scheduler] Перевірка підписок...');
  try {
    // TODO: підключити features/subscription/handlers.js коли буде готово
    console.log('[scheduler] ⚠️ Перевірка підписок поки не реалізована');
  } catch (error) {
    console.error('[scheduler/checkSubscriptions] ❌ Помилка:', error);
  }
};

/**
 * Щотижневі звіти
 */
const sendWeeklyReports = async (bot) => {
  console.log('📊 [scheduler] Відправка щотижневих звітів...');
  try {
    const users = await getActiveUsers();
    console.log(`[scheduler] Знайдено активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = getChatId(user);
      if (!tgId) {
        console.error('[scheduler] ❌ Пропущено: chat_id порожній (TG_id відсутній)');
        continue;
      }

      try {
        await bot.telegram.sendMessage(
          tgId,
          SCHEDULER_MESSAGES.WEEKLY_PROMPT,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 Переглянути звіт', callback_data: 'show_weekly_report' }],
                [{ text: '⏭ Пізніше', callback_data: 'later_weekly' }]
              ]
            }
          }
        );
        console.log(`[scheduler] ✅ Тижневий звіт надіслано TG=${tgId}`);
      } catch (err) {
        console.error(`[scheduler] ❌ Помилка відправки звіту TG=${tgId}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[scheduler/sendWeeklyReports] ❌ Помилка:', error);
  }
};

/**
 * Щомісячна перевірка колеса балансу
 */
const monthlyWheelCheck = async (bot) => {
  console.log('🎯 [scheduler] Щомісячна перевірка колеса балансу...');
  try {
    const users = await getActiveUsers();
    console.log(`[scheduler] Знайдено активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = getChatId(user);
      if (!tgId) {
        console.error('[scheduler] ❌ Пропущено: chat_id порожній (TG_id відсутній)');
        continue;
      }

      const userName = getUserName(user);

      try {
        await bot.telegram.sendMessage(
          tgId,
          `🎯 Привіт, ${userName}!\n\nНастав час оновити твоє Колесо балансу! Це допоможе побачити прогрес та скоригувати фокус на наступний місяць.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' }],
                [{ text: '⏭ Пізніше', callback_data: 'later_wheel' }]
              ]
            }
          }
        );
        console.log(`[scheduler] ✅ Нагадування про колесо надіслано TG=${tgId}`);
      } catch (err) {
        console.error(`[scheduler] ❌ Помилка відправки колеса TG=${tgId}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[scheduler/monthlyWheelCheck] ❌ Помилка:', error);
  }
};

/**
 * Запустити планувальник
 */
export const startScheduler = (bot) => {
  console.log('⏰ [scheduler] Запуск планувальника...');

  try {
    // Ранкові питання
    const morningJob = cron.schedule(
      CRON_SCHEDULES.MORNING_QUESTIONS,
      () => sendMorningQuestions(bot),
      { timezone: 'Europe/Prague' }
    );
    jobs.push(morningJob);
    console.log(`[scheduler] ✅ Ранкові питання: ${CRON_SCHEDULES.MORNING_QUESTIONS}`);

    // Вечірні питання
    const eveningJob = cron.schedule(
      CRON_SCHEDULES.EVENING_QUESTIONS,
      () => sendEveningQuestions(bot),
      { timezone: 'Europe/Prague' }
    );
    jobs.push(eveningJob);
    console.log(`[scheduler] ✅ Вечірні питання: ${CRON_SCHEDULES.EVENING_QUESTIONS}`);

    // Щотижневі звіти
    const weeklyJob = cron.schedule(
      CRON_SCHEDULES.WEEKLY_REPORTS,
      () => sendWeeklyReports(bot),
      { timezone: 'Europe/Prague' }
    );
    jobs.push(weeklyJob);
    console.log(`[scheduler] ✅ Щотижневі звіти: ${CRON_SCHEDULES.WEEKLY_REPORTS}`);

    // Щомісячне колесо балансу
    const monthlyJob = cron.schedule(
      CRON_SCHEDULES.MONTHLY_WHEEL_CHECK,
      () => monthlyWheelCheck(bot),
      { timezone: 'Europe/Prague' }
    );
    jobs.push(monthlyJob);
    console.log(`[scheduler] ✅ Щомісячне колесо: ${CRON_SCHEDULES.MONTHLY_WHEEL_CHECK}`);

    // Перевірка підписок
    const subscriptionJob = cron.schedule(
      CRON_SCHEDULES.SUBSCRIPTION_CHECK,
      () => checkSubscriptions(bot),
      { timezone: 'Europe/Prague' }
    );
    jobs.push(subscriptionJob);
    console.log(`[scheduler] ✅ Перевірка підписок: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);

    console.log(`[scheduler] ✅ Всього завдань: ${jobs.length}`);
  } catch (error) {
    console.error('[scheduler/startScheduler] ❌ Помилка:', error);
    throw error;
  }
};

/**
 * Зупинити планувальник
 */
export const stopScheduler = () => {
  console.log('⏰ [scheduler] Зупинка планувальника...');

  for (const job of jobs) {
    try {
      job.stop();
    } catch (error) {
      console.error('[scheduler/stopScheduler] ❌ Помилка зупинки:', error);
    }
  }

  jobs = [];
  console.log('[scheduler] ✅ Планувальник зупинено');
};

export const checkInactiveUsers = async (bot) => {
  const now = new Date();
  const users = await getAllActiveUsers();
  
  for (const user of users) {
    const lastActivity = new Date(user.fields.Last_Activity);
    const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
    
    // ✅ Якщо не було активності 48+ годин
    if (hoursSinceActivity >= 48) {
      await bot.telegram.sendMessage(
        user.fields.TG_id,
        '⏰ Привіт! Давно не бачились. Хочеш продовжити роботу над цілями?',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌞 Ранкова рефлексія', callback_data: 'start_morning' }]
            ]
          }
        }
      );
    }
  }
};

console.log('✅ [services/scheduler] Scheduler завантажено');
