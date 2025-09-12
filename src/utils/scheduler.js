// src/utils/scheduler.js - ВИПРАВЛЕНО ДУБЛЮВАННЯ

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

const jobs = []; // зберігаємо усі задачі
const sentReminders = new Set(); // запобігання дублікатам
const activeUsers = new Map(); // кеш активних користувачів для debouncing

// ✅ ГЛОБАЛЬНИЙ DEBOUNCER ДЛЯ ПОВІДОМЛЕНЬ
const messageSent = new Map(); // tgId -> timestamp останнього повідомлення
const MESSAGE_COOLDOWN = 60 * 1000; // 1 хвилина між однаковими повідомленнями

const canSendMessage = (tgId, messageType) => {
  const key = `${tgId}_${messageType}`;
  const now = Date.now();
  const lastSent = messageSent.get(key);
  
  if (!lastSent || (now - lastSent) > MESSAGE_COOLDOWN) {
    messageSent.set(key, now);
    return true;
  }
  
  console.log(`[scheduler] ⏭️ Пропущено дублікат ${messageType} для ${tgId} (cooldown)`);
  return false;
};

// ✅ ЗАХИЩЕНА ФУНКЦІЯ НАДСИЛАННЯ ПОВІДОМЛЕНЬ
const safeSendMessage = async (bot, tgId, message, messageType, keyboardOptions = null) => {
  try {
    if (!canSendMessage(tgId, messageType)) {
      return false; // повідомлення заблоковано через cooldown
    }

    await bot.telegram.sendMessage(tgId, message, keyboardOptions);
    console.log(`[scheduler] ✅ Надіслано ${messageType} користувачу ${tgId}`);
    return true;
  } catch (error) {
    console.error(`[scheduler] ❌ Помилка надсилання ${messageType} користувачу ${tgId}:`, error);
    return false;
  }
};

// ✅ DEBOUNCED ФУНКЦІЯ ОТРИМАННЯ АКТИВНИХ КОРИСТУВАЧІВ
let usersCache = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

const getActiveUsersDebounced = async () => {
  const now = Date.now();
  
  if (usersCache && (now - usersCacheTime) < USERS_CACHE_TTL) {
    console.log(`[scheduler] 📋 Використовуємо кеш користувачів (${usersCache.length} активних)`);
    return usersCache;
  }
  
  console.log(`[scheduler] 🔄 Оновлюємо кеш активних користувачів...`);
  usersCache = await userService.getActiveUsers();
  usersCacheTime = now;
  
  console.log(`[scheduler] ✅ Оновлено кеш: ${usersCache.length} активних користувачів`);
  return usersCache;
};

// ✅ ВИПРАВЛЕНА ФУНКЦІЯ НАГАДУВАНЬ
const sendReminder = async (bot, type, tgId, name) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const reminderKey = `${tgId}_${type}_${today}`;
    
    // Перевірка на дублікати
    if (sentReminders.has(reminderKey)) {
      console.log(`[scheduler] ⏭️ Пропущено дублікат нагадування ${type} для ${tgId}`);
      return false;
    }
    
    // Перевірка чи сесія вже завершена
    const isCompleted = await responseService.isSessionCompleted(tgId, type);
    if (isCompleted) {
      console.log(`[scheduler] ⏭️ Сесія ${type} вже завершена для ${tgId}`);
      return false;
    }

    const message = type === QUESTION_TYPES.MORNING
      ? SCHEDULER_MESSAGES.MORNING_REMINDER
      : SCHEDULER_MESSAGES.EVENING_REMINDER;

    const success = await safeSendMessage(bot, tgId, message, `${type}_reminder`);
    
    if (success) {
      sentReminders.add(reminderKey);
    }
    
    return success;
  } catch (error) {
    console.error(`[scheduler] ❌ Помилка нагадування ${type} для ${tgId}:`, error);
    return false;
  }
};

// ✅ ВИПРАВЛЕНА ФУНКЦІЯ РАНКОВИХ НАГАДУВАНЬ
const sendMorningReminder = async (bot) => {
  try {
    console.log(`[scheduler] 🔔 РАНКОВІ НАГАДУВАННЯ - ${new Date().toLocaleString('uk-UA')}`);
    
    const users = await getActiveUsersDebounced();
    console.log(`[scheduler] 📋 Обробляємо ${users.length} активних користувачів`);

    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      const success = await sendReminder(bot, QUESTION_TYPES.MORNING, tgId, name);
      if (success) {
        sent++;
      } else {
        skipped++;
      }
      
      // Затримка між повідомленнями
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
    
    console.log(`[scheduler] 📊 Ранкові нагадування: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка ранкових нагадувань:', error);
  }
};

// ✅ ВИПРАВЛЕНА ФУНКЦІЯ ВЕЧІРНІХ НАГАДУВАНЬ  
const sendEveningReminder = async (bot) => {
  try {
    console.log(`[scheduler] 🔔 ВЕЧІРНІ НАГАДУВАННЯ - ${new Date().toLocaleString('uk-UA')}`);
    
    const users = await getActiveUsersDebounced();
    console.log(`[scheduler] 📋 Обробляємо ${users.length} активних користувачів`);

    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      const success = await sendReminder(bot, QUESTION_TYPES.EVENING, tgId, name);
      if (success) {
        sent++;
      } else {
        skipped++;
      }
      
      await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.USER_DELAY_MS));
    }
    
    console.log(`[scheduler] 📊 Вечірні нагадування: надіслано ${sent}, пропущено ${skipped}`);
  } catch (error) {
    console.error('[scheduler] ❌ Критична помилка вечірніх нагадувань:', error);
  }
};

// ✅ ОЧИЩЕННЯ КЕШІВ О ПІВНОЧІ
const clearDailyCache = () => {
  console.log('[scheduler] 🧹 Очищення денних кешів');
  sentReminders.clear();
  messageSent.clear();
  usersCache = null;
  usersCacheTime = 0;
};

// ✅ ВИПРАВЛЕНИЙ ПЛАНУВАЛЬНИК З ЗАЩИТОМ ВІД ДУБЛІКАТІВ
const startScheduler = (bot) => {
  // ✅ ЗУПИНЯЄМО ВСІ ПОПЕРЕДНІ ЗАДАЧІ
  console.log('[scheduler] 🛑 Зупиняємо попередні задачі...');
  jobs.forEach(job => {
    try {
      job.destroy();
    } catch (e) {
      console.warn('[scheduler] Помилка зупинки задачі:', e.message);
    }
  });
  jobs.length = 0; // очищаємо масив

  console.log('[scheduler] ✅ Запуск нового планувальника...');

  // Очищення кешів о півночі
  jobs.push(
    cron.schedule('0 0 * * *', clearDailyCache, {
      timezone: SCHEDULE.TIMEZONE,
      name: 'daily_cache_clear'
    })
  );

  // ✅ ТІЛЬКИ НАГАДУВАННЯ (не початок сесій)
  // Ранкові нагадування
  jobs.push(
    cron.schedule(CRON_SCHEDULES.MORNING_REMINDER, () => {
      sendMorningReminder(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      name: 'morning_reminders'
    })
  );

  // Вечірні нагадування  
  jobs.push(
    cron.schedule(CRON_SCHEDULES.EVENING_REMINDER, () => {
      sendEveningReminder(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      name: 'evening_reminders'
    })
  );

  // ✅ ЩОМІСЯЧНА ПЕРЕВІРКА КОЛЕСА БАЛАНСУ
  jobs.push(
    cron.schedule('0 10 1 * *', async () => {
      try {
        console.log(`[scheduler] 🎯 Щомісячна перевірка колеса балансу`);
        await wheelBalanceController.checkMonthlyWheelNeed(bot);
      } catch (error) {
        console.error('[scheduler] ❌ Помилка щомісячної перевірки:', error);
      }
    }, {
      timezone: SCHEDULE.TIMEZONE,
      name: 'monthly_wheel_check'
    })
  );

  console.log(`[scheduler] ✅ Планувальник запущено:`);
  console.log(`- ${jobs.length} активних задач`);
  console.log(`- Ранкові нагадування: ${CRON_SCHEDULES.MORNING_REMINDER}`);
  console.log(`- Вечірні нагадування: ${CRON_SCHEDULES.EVENING_REMINDER}`);
  console.log(`- Часова зона: ${SCHEDULE.TIMEZONE}`);
  
  // ✅ ДІАГНОСТИКА АКТИВНИХ ЗАДАЧ
  jobs.forEach((job, index) => {
    console.log(`- Задача ${index + 1}: ${job.options?.name || 'unnamed'} - ${job.running ? 'запущена' : 'зупинена'}`);
  });
};

// ✅ ФУНКЦІЯ ЗУПИНКИ ПЛАНУВАЛЬНИКА
const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка планувальника...');
  
  jobs.forEach((job, index) => {
    try {
      job.destroy();
      console.log(`[scheduler] ✅ Зупинено задачу ${index + 1}`);
    } catch (error) {
      console.error(`[scheduler] ❌ Помилка зупинки задачі ${index + 1}:`, error);
    }
  });
  
  jobs.length = 0;
  clearDailyCache();
  
  console.log('[scheduler] ✅ Планувальник зупинено');
};

export { startScheduler, stopScheduler };