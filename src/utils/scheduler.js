// src/utils/scheduler.js - ВИПРАВЛЕНО ДУБЛІКАТИ

import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import responseService from '../dialogue/services/responseService.js';
import {
  CRON_SCHEDULES,
  SCHEDULER_MESSAGES,
  QUESTION_TYPES,
  ANSWER_STEPS,
  SCHEDULE,
  SCHEDULER_CONFIG,
  MORNING_QUESTIONS,
  EVENING_QUESTIONS,
} from '../config/constants.js';
import { schedulePendingReminders } from '../middleware/pendingFlow.js';
import wheelBalanceController from '../controllers/wheelBalanceController.js';

const jobs = [];
const sentReminders = new Set();
const messageSent = new Map();
const MESSAGE_COOLDOWN = 60 * 1000;

// 🔒 Глобальні локи від повторного виклику в межах хвилини
const tickLocks = new Map();
const userStartLocks = new Set();
const inFlightUsers = new Set();

const minuteKey = (type) => {
  const iso = new Date().toISOString().slice(0, 16);
  return `${type}_${iso}`;
};

const guardTick = (type) => {
  const key = minuteKey(type);
  if (tickLocks.has(key)) {
    console.log(`[scheduler] ⏭️ Skip duplicate tick for ${type} @ ${key}`);
    return false;
  }
  tickLocks.set(key, Date.now());
  setTimeout(() => tickLocks.delete(key), 70 * 1000).unref?.();
  return true;
};

const canSendMessage = (tgId, messageType) => {
  const key = `${tgId}_${messageType}`;
  const now = Date.now();
  const lastSent = messageSent.get(key);
  if (!lastSent || (now - lastSent) > MESSAGE_COOLDOWN) {
    messageSent.set(key, now);
    return true;
  }
  return false;
};

const safeSendMessage = async (bot, tgId, message, messageType, keyboardOptions = null) => {
  try {
    if (!canSendMessage(tgId, messageType)) return false;
    
    if (messageType.includes('reminder') && !keyboardOptions) {
      keyboardOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Продовжити відповіді', callback_data: 'continue_answers' }],
            [{ text: '⏭️ Пропустити сесію', callback_data: 'skip_session' }]
          ]
        }
      };
    }
    
    await bot.telegram.sendMessage(tgId, message, keyboardOptions);
    console.log(`[scheduler] ✅ Надіслано ${messageType} користувачу ${tgId}`);
    return true;
  } catch (error) {
    console.error(`[scheduler] ❌ Помилка надсилання ${messageType} користувачу ${tgId}:`, error);
    return false;
  }
};

let usersCache = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 5 * 60 * 1000;

const getActiveUsersDebounced = async () => {
  const now = Date.now();
  if (usersCache && (now - usersCacheTime) < USERS_CACHE_TTL) {
    return usersCache;
  }
  usersCache = await userService.getActiveUsers();
  usersCacheTime = now;
  console.log(`[scheduler] ✅ Оновлено кеш: ${usersCache.length} активних користувачів`);
  return usersCache;
};

// ✅ ВИПРАВЛЕНО - БЕЗ ДУБЛІКАТІВ
const sendReminder = async (bot, type, tgId, name) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const isMorning = type === QUESTION_TYPES.MORNING;
    const startStep = isMorning ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;

    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step || '';
    const sessionActive = isMorning ? step.startsWith('Q_m_') : step.startsWith('Q_e_');

    const completed = await responseService.isSessionCompleted(tgId, type);
    
    if (completed && !sessionActive) {
      const restartKey = `${tgId}_${type}_${today}_restart`;
      if (userStartLocks.has(restartKey)) return false;
      userStartLocks.add(restartKey);

      const inflightKey = `${tgId}_${type}`;
      if (inFlightUsers.has(inflightKey)) return false;
      inFlightUsers.add(inflightKey);

      try {
        await userService.updateUserStep(tgId, startStep);
        const msg = isMorning
          ? SCHEDULER_MESSAGES.MORNING_SESSION_START(name)
          : SCHEDULER_MESSAGES.EVENING_SESSION_START(name);
        const ok = await safeSendMessage(bot, tgId, msg, `${type}_restart`);
        if (ok) schedulePendingReminders(bot, tgId, isMorning ? 'Morning' : 'Evening');
        return ok;
      } finally {
        inFlightUsers.delete(inflightKey);
      }
    }

    if (!sessionActive) {
      const startKey = `${tgId}_${type}_${today}_start`;
      if (userStartLocks.has(startKey)) return false;
      userStartLocks.add(startKey);

      const inflightKey = `${tgId}_${type}`;
      if (inFlightUsers.has(inflightKey)) return false;
      inFlightUsers.add(inflightKey);

      try {
        await userService.updateUserStep(tgId, startStep);
        const firstQuestion = isMorning
          ? `🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`
          : `🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`;
        const ok = await safeSendMessage(bot, tgId, firstQuestion, `${type}_start`);
        if (ok) schedulePendingReminders(bot, tgId, isMorning ? 'Morning' : 'Evening');
        return ok;
      } finally {
        inFlightUsers.delete(inflightKey);
      }
    }

    const reminderKey = `${tgId}_${type}_${today}_reminder`;
    if (sentReminders.has(reminderKey)) return false;
    
    const msg = isMorning ? SCHEDULER_MESSAGES.MORNING_REMINDER : SCHEDULER_MESSAGES.EVENING_REMINDER;
    const ok = await safeSendMessage(bot, tgId, msg, `${type}_reminder`);
    if (ok) sentReminders.add(reminderKey);
    return ok;

  } catch (error) {
    console.error(`[scheduler] ❌ Помилка нагадування ${type} для ${tgId}:`, error);
    return false;
  }
};

const sendMorningReminder = async (bot) => {
  if (!guardTick('Morning')) return;
  console.log(`[scheduler] 🔔 РАНОК - ${new Date().toLocaleString('uk-UA')}`);

  try {
    const users = await getActiveUsersDebounced();
    let sent = 0, skipped = 0;
    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      const ok = await sendReminder(bot, QUESTION_TYPES.MORNING, tgId, name);
      if (ok) sent++; else skipped++;
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
    console.log(`[scheduler] 📊 Ранок: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка ранкових повідомлень:', error);
  }
};

const sendEveningReminder = async (bot) => {
  if (!guardTick('Evening')) return;
  console.log(`[scheduler] 🔔 ВЕЧІР - ${new Date().toLocaleString('uk-UA')}`);

  try {
    const users = await getActiveUsersDebounced();
    let sent = 0, skipped = 0;
    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      const ok = await sendReminder(bot, QUESTION_TYPES.EVENING, tgId, name);
      if (ok) sent++; else skipped++;
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
    console.log(`[scheduler] 📊 Вечір: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка вечірніх повідомлень:', error);
  }
};

// ✅ ВИПРАВЛЕНО - ОДИН РАЗ НА ДЕНЬ
const sendReportsReminder = async (bot) => {
  if (!guardTick('Reports')) return;
  console.log(`[scheduler] 💡 Нагадування про звіти - ${new Date().toLocaleString('uk-UA')}`);

  try {
    const users = await getActiveUsersDebounced();
    console.log(`[scheduler] 💡 Нагадування про звіти - Знайдено ${users.length} активних користувачів`);
    
    for (const user of users) {
      const tgId = user['TG_id'];
      await safeSendMessage(bot, tgId, SCHEDULER_MESSAGES.REPORTS_REMINDER, 'reports_reminder');
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.REPORT_DELAY_MS));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка нагадування про звіти:', error);
  }
};

const clearDailyCache = () => {
  console.log('[scheduler] 🧹 Очищення денних кешів');
  sentReminders.clear();
  messageSent.clear();
  usersCache = null;
  usersCacheTime = 0;
  userStartLocks.clear();
};

const createAndStartTask = (expression, fn, name) => {
  const task = cron.schedule(expression, fn, { timezone: SCHEDULE.TIMEZONE, name, scheduled: true });
  try { task.start(); } catch (_) {}
  jobs.push(task);
  return task;
};

const startScheduler = (bot) => {
  console.log('[scheduler] 🛑 Зупиняємо попередні задачі...');
  jobs.forEach(job => { try { job.destroy(); } catch (e) { console.warn('[scheduler] Помилка зупинки задачі:', e.message); } });
  jobs.length = 0;

  console.log('[scheduler] ✅ Запуск нового планувальника...');

  createAndStartTask('0 0 * * *', clearDailyCache, 'daily_cache_clear');
  createAndStartTask(CRON_SCHEDULES.MORNING_REMINDER, () => { sendMorningReminder(bot); }, 'morning_session');
  createAndStartTask(CRON_SCHEDULES.EVENING_REMINDER, () => { sendEveningReminder(bot); }, 'evening_session');
  createAndStartTask('0 18 * * *', () => { sendReportsReminder(bot); }, 'reports_reminder'); // ✅ ОДИН РАЗ НА ДЕНЬ
  createAndStartTask('0 10 1 * *', async () => {
    try {
      console.log(`[scheduler] 🎯 Щомісячна перевірка колеса балансу`);
      await wheelBalanceController.checkMonthlyWheelNeed(bot);
    } catch (error) {
      console.error('[scheduler] ❌ Помилка щомісячної перевірки:', error);
    }
  }, 'monthly_wheel_check');

  console.log(`[scheduler] ✅ Планувальник запущено: ${jobs.length} задач`);
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

export { startScheduler, stopScheduler };