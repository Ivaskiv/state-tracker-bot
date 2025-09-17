// src/utils/scheduler.js - ДОДАНО ПЕРЕВІРКУ ПІДПИСОК

import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import subscriptionService from '../auth/services/subscriptionService.js'; // ✅ ДОДАНО
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

// Глобальні локи від повторного виклику
const executionLocks = new Map();
const userSessionLocks = new Set();
const messageCooldowns = new Map();

const MESSAGE_COOLDOWN = 60 * 1000; // 1 хвилина
const SESSION_LOCK_TTL = 5 * 60 * 1000; // 5 хвилин

const getMinuteKey = (type) => {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  return `${type}_${minute}`;
};

const guardExecution = (type) => {
  const key = getMinuteKey(type);
  
  if (executionLocks.has(key)) {
    console.log(`[scheduler] ⏭️ ПРОПУСК дублювання ${type} @ ${key}`);
    return false;
  }
  
  executionLocks.set(key, Date.now());
  
  setTimeout(() => {
    executionLocks.delete(key);
  }, 2 * 60 * 1000);
  
  return true;
};

const canSendMessage = (tgId, messageType) => {
  const key = `${tgId}_${messageType}`;
  const now = Date.now();
  const lastSent = messageCooldowns.get(key);
  
  if (lastSent && (now - lastSent) < MESSAGE_COOLDOWN) {
    return false;
  }
  
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
  
  setTimeout(() => {
    userSessionLocks.delete(key);
  }, SESSION_LOCK_TTL);
  
  return true;
};

const safeSendMessage = async (bot, tgId, message, messageType, keyboardOptions = null) => {
  try {
    if (!canSendMessage(tgId, messageType)) {
      console.log(`[scheduler] ⏭️ COOLDOWN активний для ${tgId}_${messageType}`);
      return false;
    }
    
    // ✅ АВТОМАТИЧНО ДОДАЄМО КНОПКИ ДЛЯ ВСІХ НАГАДУВАНЬ
    if (!keyboardOptions) {
      keyboardOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Продовжити відповідати', callback_data: 'continue_answers' }],
            [{ text: '🚪 Пропустити сесію', callback_data: 'skip_session' }]
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

// Кешування користувачів
let usersCache = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 5 * 60 * 1000;

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

// ✅ ПЕРЕВІРКА ПІДПИСКИ ПЕРЕД ВІДПРАВКОЮ
const sendSessionMessage = async (bot, type, tgId, name) => {
  try {
    const sessionType = type === QUESTION_TYPES.MORNING ? 'Morning' : 'Evening';
    
    if (!canStartSession(tgId, sessionType)) {
      return false;
    }
    
    console.log(`[scheduler] 🚀 ОБРОБКА ${sessionType} сесії для ${tgId}`);
    
    // ✅ ПЕРЕВІРКА ПІДПИСКИ
    const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
    if (!subscriptionStatus.active) {
      console.log(`[scheduler] ⏭️ ПРОПУСК ${sessionType} - підписка неактивна для ${tgId}`);
      return false;
    }
    
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step || '';
    const sessionActive = type === QUESTION_TYPES.MORNING ? step.startsWith('Q_m_') : step.startsWith('Q_e_');
    
    // ✅ ЯКЩО СЕСІЯ ВЖЕ АКТИВНА - НЕ СТВОРЮЄМО НОВУ
    if (sessionActive) {
      console.log(`[scheduler] ⏭️ ПРОПУСК ${sessionType} - сесія вже активна для ${tgId}`);
      return false;
    }
    
    const completed = await responseService.isSessionCompleted(tgId, type);
    
    // ✅ ЯКЩО ЗАВЕРШЕНО - ПРОПОНУЄМО РЕСТАРТ
    if (completed) {
      const message = type === QUESTION_TYPES.MORNING
        ? `🌞 Ти вже завершила ранкові питання сьогодні.\n\n🔄 Хочеш оновити відповіді?`
        : `🌙 Ти вже завершила вечірні питання сьогодні.\n\n🔄 Хочеш оновити відповіді?`;
      
      return await safeSendMessage(bot, tgId, message, `${sessionType}_restart_offer`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Оновити відповіді', callback_data: `restart_${type.toLowerCase()}` }],
            [{ text: '❌ Пропустити', callback_data: 'cancel_restart' }]
          ]
        }
      });
    }
    
    // ✅ ТІЛЬКИ ЯКЩО НЕ ЗАВЕРШЕНО І НЕ АКТИВНА - СТВОРЮЄМО НОВУ СЕСІЮ
    const startStep = type === QUESTION_TYPES.MORNING ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
    
    console.log(`[scheduler] 🎯 ЗАПУСК нової ${sessionType} сесії для ${tgId}`);
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
      
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
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
      
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
    
    console.log(`[scheduler] 📊 Вечір: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка вечірніх повідомлень:', error);
  }
};

const sendReportsReminder = async (bot) => {
  if (!guardExecution('Reports')) return;
  
  console.log(`[scheduler] 💡 Нагадування про звіти`);

  try {
    const users = await getActiveUsers();
    
    for (const user of users) {
      const tgId = user['TG_id'];
      
      // ✅ ПЕРЕВІРКА ПІДПИСКИ
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      if (!subscriptionStatus.active) continue;
      
      await safeSendMessage(bot, tgId, SCHEDULER_MESSAGES.REPORTS_REMINDER, 'reports_reminder');
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.REPORT_DELAY_MS));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка нагадування про звіти:', error);
  }
};

// ✅ ЩОДЕННА ПЕРЕВІРКА ПІДПИСОК
const checkSubscriptions = async (bot) => {
  if (!guardExecution('SubscriptionCheck')) return;
  
  console.log('[scheduler] 💰 Перевірка підписок');
  
  try {
    // Деактивуємо закінчені підписки
    const deactivated = await subscriptionService.deactivateExpiredSubscriptions();
    console.log(`[scheduler] ✅ Деактивовано ${deactivated} підписок`);
    
    // Надсилаємо нагадування
    const reminders = await subscriptionService.sendSubscriptionReminders(bot);
    console.log(`[scheduler] ✅ Надіслано ${reminders} нагадувань`);
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка перевірки підписок:', error);
  }
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
    scheduled: true 
  });
  jobs.push(task);
  return task;
};

const startScheduler = (bot) => {
  console.log('[scheduler] 🛑 Зупиняємо попередні задачі...');
  jobs.forEach(job => { 
    try { 
      job.destroy(); 
    } catch (e) { 
      console.warn('[scheduler] Помилка зупинки:', e.message); 
    } 
  });
  jobs.length = 0;

  console.log('[scheduler] ✅ Запуск нового планувальника...');

  createTask('0 0 * * *', clearDailyCache, 'daily_cache_clear');
  createTask(CRON_SCHEDULES.MORNING_REMINDER, () => sendMorningReminder(bot), 'morning_session');
  createTask(CRON_SCHEDULES.EVENING_REMINDER, () => sendEveningReminder(bot), 'evening_session');
  createTask('0 18 * * *', () => sendReportsReminder(bot), 'reports_reminder');
  createTask('0 10 * * *', () => checkSubscriptions(bot), 'subscription_check'); // ✅ ЩОДЕННА ПЕРЕВІРКА О 10:00
  createTask('0 10 1 * *', async () => {
    try {
      await wheelBalanceController.checkMonthlyWheelNeed(bot);
    } catch (error) {
      console.error('[scheduler] ❌ Помилка щомісячної перевірки:', error);
    }
  }, 'monthly_wheel_check');

  console.log(`[scheduler] ✅ Планувальник запущено: ${jobs.length} задач`);
  console.log(`[scheduler] 📅 Ранок: ${CRON_SCHEDULES.MORNING_REMINDER}`);
  console.log(`[scheduler] 📅 Вечір: ${CRON_SCHEDULES.EVENING_REMINDER}`);
  console.log(`[scheduler] 💰 Підписки: 0 10 * * * (щодня о 10:00)`);
};

const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка планувальника...');
  jobs.forEach((job, index) => {
    try { 
      job.destroy(); 
      console.log(`[scheduler] ✅ Зупинено задачу ${index + 1}`); 
    }
    catch (error) { 
      console.error(`[scheduler] ❌ Помилка зупинки задачі ${index + 1}:`, error); 
    }
  });
  jobs.length = 0;
  clearDailyCache();
  console.log('[scheduler] ✅ Планувальник зупинено');
};

export { startScheduler, stopScheduler };