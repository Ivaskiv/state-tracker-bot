// src/utils/scheduler.js - ВИПРАВЛЕНО: конфлікт колесо/нагадування + щомісячні перевірки

import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import subscriptionController from '../controllers/subscriptionController.js';
import paymentService from '../auth/services/paymentService.js';
import responseService from '../dialogue/services/responseService.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import wheelBalanceController from '../controllers/wheelBalanceController.js';
import { aiMentorSession } from '../aiMentor/session.js';

import {
  CRON_SCHEDULES,
  QUESTION_TYPES,
  ANSWER_STEPS,
  SCHEDULE,
  MORNING_QUESTIONS,
  EVENING_QUESTIONS,
} from '../config/constants.js';

import { schedulePendingReminders } from '../middleware/pendingFlow.js';

// Внутрішні стани
const jobs = [];
const executionLocks = new Map();
const userSessionLocks = new Set();
const messageCooldowns = new Map();

const MESSAGE_COOLDOWN = 60 * 1000;
const SESSION_LOCK_TTL = 5 * 60 * 1000;

let usersCache = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 5 * 60 * 1000;

// Хелпери блокувань
const getMinuteKey = (type) => {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16);
  return `${type}_${minute}`;
};

const guardExecution = (type) => {
  const key = getMinuteKey(type);
  if (executionLocks.has(key)) {
    console.log(`[scheduler] ⏭️ ПРОПУСК дублювання ${type} @ ${key}`);
    return false;
  }
  executionLocks.set(key, Date.now());
  setTimeout(() => executionLocks.delete(key), 2 * 60 * 1000);
  return true;
};

const canSendMessage = (tgId, messageType) => {
  const key = `${tgId}_${messageType}`;
  const now = Date.now();
  const lastSent = messageCooldowns.get(key);
  if (lastSent && (now - lastSent) < MESSAGE_COOLDOWN) return false;
  messageCooldowns.set(key, now);
  return true;
};

const canStartSession = (tgId, sessionType) => {
  const key = `${tgId}_${sessionType}_${new Date().toDateString()}`;
  if (userSessionLocks.has(key)) {
    console.log(`[scheduler] ⏭️ ПРОПУСК дублювання сесії ${sessionType} для ${tgId}`);
    return false;
  }
  userSessionLocks.add(key);
  setTimeout(() => userSessionLocks.delete(key), SESSION_LOCK_TTL);
  return true;
};

const clearDailyCache = () => {
  console.log('[scheduler] 🧹 Очищення денних кешів');
  messageCooldowns.clear();
  userSessionLocks.clear();
  usersCache = null;
  usersCacheTime = 0;
  executionLocks.clear();
};

const createTask = (expression, fn, name) => {
  const task = cron.schedule(expression, fn, {
    timezone: SCHEDULE.TIMEZONE,
    name,
    scheduled: true,
  });
  jobs.push(task);
  return task;
};

// Базова вибірка активних користувачів (із кешем)
const getActiveUsers = async () => {
  const now = Date.now();
  if (usersCache && (now - usersCacheTime) < USERS_CACHE_TTL) {
    return usersCache;
  }
  usersCache = await userService.getActiveUsers();
  usersCacheTime = now;
  console.log(`[scheduler] ✅ Оновлено кеш: ${usersCache.length} активних користувачів`);
  return usersCache;
};

// ✅ КЛЮЧОВА ЛОГІКА: перевірка чи можна надіслати нагадування
const canReceiveReminder = async (tgId) => {
  try {
    // 1) Перевіряємо активне колесо балансу
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    if (activeWheel) {
      console.log(`[scheduler] ⏭️ БЛОК: нагадування для ${tgId} — активне колесо`);
      return false;
    }

    // 2) Перевіряємо активну AI-сесію
    if (aiMentorSession.isActive(tgId)) {
      console.log(`[scheduler] ⏭️ БЛОК: нагадування для ${tgId} — активний AI`);
      return false;
    }

    // 3) Перевіряємо незавершені питання-відповіді
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step || '';
    
    if (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'))) {
      console.log(`[scheduler] ⏭️ БЛОК: нагадування для ${tgId} — активні питання ${step}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[scheduler] ❌ Помилка перевірки можливості нагадування для ${tgId}:`, error);
    return false;
  }
};

// Відправка повідомлення користувачу
const safeSendMessage = async (bot, tgId, message, messageType, keyboardOptions = null) => {
  try {
    if (!canSendMessage(tgId, messageType)) {
      console.log(`[scheduler] ⏭️ COOLDOWN активний для ${tgId}_${messageType}`);
      return false;
    }

    const options = keyboardOptions || {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚪 Пропустити сесію', callback_data: 'exit_session' }],
        ],
      },
    };

    await bot.telegram.sendMessage(tgId, message, options);
    console.log(`[scheduler] ✅ Надіслано ${messageType} користувачу ${tgId}`);
    return true;
  } catch (error) {
    console.error(`[scheduler] ❌ Помилка надсилання ${messageType} користувачу ${tgId}:`, error);
    return false;
  }
};

// ✅ ЗАПУСК СЕСІЇ (ранок/вечір) з усіма перевірками
const sendSessionMessage = async (bot, type, tgId, name) => {
  try {
    const sessionType = type === QUESTION_TYPES.MORNING ? 'Morning' : 'Evening';

    // 0) КЛЮЧОВА ПЕРЕВІРКА: чи можна показувати нагадування
    const canReceive = await canReceiveReminder(tgId);
    if (!canReceive) {
      console.log(`[scheduler] ⏭️ БЛОКУВАННЯ ${sessionType} для ${tgId} — активна інша сесія`);
      return false;
    }

    if (!canStartSession(tgId, sessionType)) {
      return false;
    }

    console.log(`[scheduler] 🚀 ОБРОБКА ${sessionType} сесії для ${tgId}`);

    // 1) підписка
    const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
    if (!subscriptionStatus.active) {
      console.log(`[scheduler] ⏭️ ПРОПУСК ${sessionType} — підписка неактивна для ${tgId}`);
      return false;
    }

    // 2) чи завершено сьогодні
    const completed = await responseService.isSessionCompleted(tgId, type);
    if (completed) {
      const message = type === QUESTION_TYPES.MORNING
        ? `🌞 Ти вже завершила ранкові питання сьогодні.\n\n🔄 Хочеш оновити відповіді?`
        : `🌙 Ти вже завершила вечірні питання сьогодні.\n\n🔄 Хочеш оновити відповіді?`;

      return await safeSendMessage(bot, tgId, message, `${sessionType}_restart_offer`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Оновити відповіді', callback_data: `restart_${type.toLowerCase()}` }],
            [{ text: '🚪 Пропустити', callback_data: 'exit_session' }],
          ],
        },
      });
    }

    // 3) старт нової сесії
    const startStep = type === QUESTION_TYPES.MORNING ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
    await userService.updateUserStep(tgId, startStep);

    const firstQuestion = type === QUESTION_TYPES.MORNING
      ? `🌞 Ранкова рефлексія, ${name}!\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`
      : `🌙 Вечірня рефлексія, ${name}!\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`;

    const sent = await safeSendMessage(bot, tgId, firstQuestion, `${sessionType}_start`);
    if (sent) {
      schedulePendingReminders(bot, tgId, sessionType);
      console.log(`[scheduler] ✅ ЗАПУЩЕНО ${sessionType} сесію для ${tgId}`);
    }
    return sent;
  } catch (error) {
    console.error(`[scheduler] ❌ Помилка сесії ${type} для ${tgId}:`, error);
    return false;
  }
};

// Розсилка ранкових/вечірніх
const sendMorningReminder = async (bot) => {
  if (!guardExecution('Morning')) return;

  console.log(`[scheduler] 🌞 РАНОК - ${new Date().toLocaleString('uk-UA')}`);
  try {
    const users = await getActiveUsers();
    let sent = 0, skipped = 0;

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      const success = await sendSessionMessage(bot, QUESTION_TYPES.MORNING, tgId, name);
      if (success) sent++; else skipped++;
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[scheduler] 📊 Ранок: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка ранкових повідомлень:', error);
  }
};

const sendEveningReminder = async (bot) => {
  if (!guardExecution('Evening')) return;

  console.log(`[scheduler] 🌙 ВЕЧІР - ${new Date().toLocaleString('uk-UA')}`);
  try {
    const users = await getActiveUsers();
    let sent = 0, skipped = 0;

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      const success = await sendSessionMessage(bot, QUESTION_TYPES.EVENING, tgId, name);
      if (success) sent++; else skipped++;
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[scheduler] 📊 Вечір: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка вечірніх повідомлень:', error);
  }
};

// Перевірки підписок
const checkSubscriptions = async (bot) => {
  if (!guardExecution('SubscriptionCheck')) return;

  console.log('[scheduler] 💰 Перевірка підписок');
  try {
    const deactivated = await subscriptionService.deactivateExpiredSubscriptions();
    console.log(`[scheduler] ✅ Деактивовано ${deactivated} підписок`);

    const reminders = await subscriptionService.sendSubscriptionReminders(bot);
    console.log(`[scheduler] ✅ Надіслано ${reminders} нагадувань`);

    await paymentService.checkExpiringSubscriptions(bot);
  } catch (error) {
    console.error('[scheduler] ❌ Помилка перевірки підписок:', error);
  }
};

// ✅ ЩОМІСЯЧНА ПЕРЕВІРКА КОЛЕСА БАЛАНСУ (1 числа о 10:00)
const checkMonthlyWheelBalance = async (bot) => {
  if (!guardExecution('MonthlyWheelCheck')) return;

  console.log('[scheduler] 🎯 ЩОМІСЯЧНА ПЕРЕВІРКА КОЛІС БАЛАНСУ - 1 ЧИСЛО');
  try {
    const remindersSent = await wheelBalanceController.checkMonthlyWheelNeed(bot);
    console.log(`[scheduler] ✅ Надіслано ${remindersSent} нагадувань про колесо балансу`);
  } catch (error) {
    console.error('[scheduler] ❌ Помилка щомісячної перевірки коліс:', error);
  }
};

// ✅ СТАРТ ПЛАНУВАЛЬНИКА
const startScheduler = (bot) => {
  console.log('[scheduler] 🛑 Зупиняємо попередні задачі...');
  jobs.forEach((job) => {
    try { job.destroy(); } catch (e) { console.warn('[scheduler] Помилка зупинки:', e.message); }
  });
  jobs.length = 0;

  console.log('[scheduler] ✅ Запуск нового планувальника...');
  console.log(`[scheduler] 🕐 Поточний час сервера: ${new Date().toLocaleString('uk-UA')}`);
  console.log(`[scheduler] 🌍 Timezone: ${SCHEDULE.TIMEZONE}`);
  console.log(`[scheduler] ⏰ Ранок буде о: ${SCHEDULE.MORNING_TIME} (${CRON_SCHEDULES.MORNING_QUESTIONS})`);
  console.log(`[scheduler] 🌙 Вечір буде о: ${SCHEDULE.EVENING_TIME} (${CRON_SCHEDULES.EVENING_QUESTIONS})`);

  // щоденне очищення кешів
  createTask('0 0 * * *', clearDailyCache, 'daily_cache_clear');

  // сесії ранку/вечора
  createTask(CRON_SCHEDULES.MORNING_REMINDER, () => sendMorningReminder(bot), 'morning_session');
  createTask(CRON_SCHEDULES.EVENING_REMINDER, () => sendEveningReminder(bot), 'evening_session');

  // підписки
  createTask('0 10 * * *', () => checkSubscriptions(bot), 'subscription_check');
  createTask('0 9 * * *', () => subscriptionController.sendExpirationReminders(bot), 'subscription_reminders');
  createTask('0 1 * * *', async () => {
    try { await subscriptionService.deactivateExpiredSubscriptions(); }
    catch (error) { console.error('[scheduler] ❌ Помилка деактивації підписок:', error); }
  }, 'subscription_deactivation');

  // ✅ КОЛЕСО БАЛАНСУ — 1 ЧИСЛА ЩОМІСЯЦЯ о 10:00
  createTask('0 10 1 * *', () => checkMonthlyWheelBalance(bot), 'monthly_wheel_check');

  console.log(`[scheduler] ✅ Планувальник запущено: ${jobs.length} задач`);
  console.log(`[scheduler] 📅 Ранок: ${CRON_SCHEDULES.MORNING_REMINDER}`);
  console.log(`[scheduler] 📅 Вечір: ${CRON_SCHEDULES.EVENING_REMINDER}`);
  console.log(`[scheduler] 💰 Підписки: 0 10 * * * (щодня о 10:00)`);
  console.log(`[scheduler] 📅 Нагадування: 0 9 * * * (щодня о 09:00)`);
  console.log(`[scheduler] 🎯 Колесо: 0 10 1 * * (1 числа кожного місяця о 10:00)`);
};

const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка планувальника...');
  jobs.forEach((job, index) => {
    try { job.destroy(); console.log(`[scheduler] ✅ Зупинено задачу ${index + 1}`); }
    catch (error) { console.error(`[scheduler] ❌ Помилка зупинки задачі ${index + 1}:`, error); }
  });
  jobs.length = 0;
  clearDailyCache();
  console.log('[scheduler] ✅ Планувальник зупинено');
};

// Експорти
export {
  startScheduler,
  stopScheduler,
  sendMorningReminder,
  sendEveningReminder,
};