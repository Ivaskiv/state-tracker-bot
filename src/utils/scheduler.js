// src/utils/scheduler.js - ОПТИМІЗОВАНО З НАГАДУВАННЯМИ

import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import paymentService from '../auth/services/paymentService.js';
import wheelBalanceController from '../controllers/wheelBalanceController.js';
import { CRON_SCHEDULES, SCHEDULE } from '../config/constants.js';

const jobs = [];
let isSchedulerStarted = false;

// Відстеження активних сесій для нагадувань
const activeSessions = new Map();
const reminderTimers = new Map();

// Простий захист від дублювання
const executionLocks = new Set();

const guardExecution = (type) => {
  const now = new Date();
  const key = `${type}_${now.toISOString().slice(0, 16)}`;
  
  if (executionLocks.has(key)) {
    console.log(`[scheduler] ⏭️ Дублювання ${type} пропущено`);
    return false;
  }
  
  executionLocks.add(key);
  setTimeout(() => executionLocks.delete(key), 120000);
  return true;
};

// Ранкові нагадування з логікою сесій
const sendMorningReminders = async (bot) => {
  if (!guardExecution('morning')) return;
  
  console.log(`[scheduler] 🌞 Ранкові нагадування - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] Знайдено ${users.length} активних користувачів`);
    
    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      if (!tgId) continue;
      
      try {
        // Перевіряємо чи вже завершили ранкові питання сьогодні
        const completedToday = await checkMorningCompletion(tgId);
        if (completedToday) {
          console.log(`[scheduler] ✅ ${tgId} вже завершив ранкові питання`);
          continue;
        }

        // Відправляємо ранкове нагадування
        await sendMorningSession(bot, tgId, name);
        
        // Запускаємо таймер нагадування через 10 хв
        scheduleSessionReminder(bot, tgId, 'Ранкова рефлексія', 'morning');
        
        console.log(`[scheduler] ✅ Ранкове нагадування надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, userError.message);
      }
      
      // Затримка між користувачами
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка ранкових нагадувань:', error);
  }
};

// Вечірні нагадування з перевіркою ранкових
const sendEveningReminders = async (bot) => {
  if (!guardExecution('evening')) return;
  
  console.log(`[scheduler] 🌙 Вечірні нагадування - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] Знайдено ${users.length} активних користувачів`);
    
    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      if (!tgId) continue;
      
      try {
        // Перевіряємо чи завершили вечірні питання
        const completedToday = await checkEveningCompletion(tgId);
        if (completedToday) {
          console.log(`[scheduler] ✅ ${tgId} вже завершив вечірні питання`);
          continue;
        }

        // Перевіряємо чи були ранкові питання
        const hadMorning = await checkMorningCompletion(tgId);
        
        let message = '';
        if (hadMorning) {
          message = `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день і зафіксувати перемоги! 🌟`;
        } else {
          message = `🌙 Добрий вечір, ${name}!\n\nСьогодні не було ранкової рефлексії, але вечірня допоможе підсумувати день! 💫\n\n📝 Важливо зафіксувати перемоги та досвід.`;
        }

        await bot.telegram.sendMessage(tgId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }],
              [{ text: '⏭ Пізніше', callback_data: 'later_evening' }]
            ]
          }
        });
        
        // Запускаємо таймер нагадування через 10 хв
        scheduleSessionReminder(bot, tgId, 'Вечірня рефлексія', 'evening');
        
        console.log(`[scheduler] ✅ Вечірнє нагадування надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, userError.message);
      }
      
      // Затримка між користувачами
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка вечірніх нагадувань:', error);
  }
};

// Відправка ранкової сесії
const sendMorningSession = async (bot, tgId, name) => {
  const message = 
    `🌞 Доброго ранку, ${name}!\n\n` +
    `✨ Час для ранкової рефлексії та налаштування на день!\n\n` +
    `📝 6 коротких питань для фокусу та мотивації`;

  await bot.telegram.sendMessage(tgId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌞 Почати ранкову рефлексію', callback_data: 'start_morning' }],
        [{ text: '⏭ Пізніше', callback_data: 'later_morning' }]
      ]
    }
  });

  // Позначаємо як активну сесію
  activeSessions.set(String(tgId), {
    type: 'morning',
    startTime: new Date(),
    reminded: false
  });
};

// Нагадування через 10 хвилин
const scheduleSessionReminder = (bot, tgId, sessionName, sessionType) => {
  const id = String(tgId);
  
  // Скасовуємо попереднє нагадування якщо є
  if (reminderTimers.has(id)) {
    clearTimeout(reminderTimers.get(id));
    reminderTimers.delete(id);
  }
  
  const timer = setTimeout(async () => {
    try {
      // Перевіряємо чи сесія ще активна
      const session = activeSessions.get(id);
      if (!session || session.reminded) return;

      const message = 
        `🔔 Нагадування\n\n` +
        `${sessionName} ще не завершена.\n\n` +
        `Продовжимо або залишимо на пізніше?`;

      await bot.telegram.sendMessage(id, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔁 Продовжити', callback_data: `continue_${sessionType}` }],
            [{ text: '🚪 Вийти', callback_data: `exit_${sessionType}` }]
          ]
        }
      });
      
      // Позначаємо що нагадування відправлено
      if (session) {
        session.reminded = true;
      }
      
      console.log(`[scheduler] 🔔 Нагадування надіслано ${id} про ${sessionName}`);
      
    } catch (error) {
      console.error('[scheduleSessionReminder] Помилка:', error);
    } finally {
      reminderTimers.delete(id);
    }
  }, 10 * 60 * 1000); // 10 хвилин
  
  reminderTimers.set(id, timer);
};

// Перевірка завершення ранкових питань
const checkMorningCompletion = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date Response})="${today}", {Q_m_6} != "")`,
        maxRecords: 1
      })
      .firstPage();
    
    return records.length > 0;
  } catch (error) {
    console.error('[checkMorningCompletion] Помилка:', error);
    return false;
  }
};

// Перевірка завершення вечірніх питань
const checkEveningCompletion = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date Response})="${today}", {Q_e_5} != "")`,
        maxRecords: 1
      })
      .firstPage();
    
    return records.length > 0;
  } catch (error) {
    console.error('[checkEveningCompletion] Помилка:', error);
    return false;
  }
};

// Щотижневі звіти
const sendWeeklyReports = async (bot) => {
  if (!guardExecution('weekly')) return;
  
  console.log(`[scheduler] 📊 Щотижневі звіти - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    
    for (const user of users) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      if (!tgId) continue;
      
      try {
        const message = 
          `📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n` +
          `Привіт, ${name}! 📈\n\n` +
          `Час проаналізувати тиждень та скоригувати стратегію на наступний.\n\n` +
          `⏱ Займе 5 хвилин`;

        await bot.telegram.sendMessage(tgId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Почати щотижневий аналіз', callback_data: 'start_weekly' }],
              [{ text: '⏭ Пізніше', callback_data: 'later_weekly' }]
            ]
          }
        });
        
        console.log(`[scheduler] ✅ Щотижневий звіт надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка щотижневого звіту для ${tgId}:`, userError.message);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка щотижневих звітів:', error);
  }
};

// Щомісячні звіти та колесо балансу
const sendMonthlyReports = async (bot) => {
  if (!guardExecution('monthly')) return;
  
  console.log(`[scheduler] 📅 Щомісячні звіти та колесо балансу - ${new Date().toLocaleString()}`);
  
  try {
    // Делегуємо до wheelBalanceController для щомісячних нагадувань
    const sentReminders = await wheelBalanceController.checkMonthlyWheelNeed(bot);
    console.log(`[scheduler] ✅ Надіслано ${sentReminders} щомісячних нагадувань про колесо`);
    
    // Перевіряємо підписки що закінчуються
    const expiredCount = await paymentService.checkExpiringSubscriptions(bot);
    console.log(`[scheduler] ✅ Надіслано ${expiredCount} нагадувань про підписки`);
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка щомісячних операцій:', error);
  }
};

// Щоденна перевірка підписок
const checkExpiredSubscriptions = async () => {
  if (!guardExecution('subscription_check')) return;
  
  console.log(`[scheduler] 💰 Перевірка закінчених підписок - ${new Date().toLocaleString()}`);
  
  try {
    const deactivated = await paymentService.deactivateExpiredSubscriptions();
    console.log(`[scheduler] ✅ Деактивовано ${deactivated} закінчених підписок`);
  } catch (error) {
    console.error('[scheduler] ❌ Помилка перевірки підписок:', error);
  }
};

// Функції управління сесіями
export const markSessionCompleted = (tgId, sessionType) => {
  const id = String(tgId);
  const session = activeSessions.get(id);
  
  if (session && session.type === sessionType) {
    activeSessions.delete(id);
    
    // Скасовуємо таймер нагадування
    if (reminderTimers.has(id)) {
      clearTimeout(reminderTimers.get(id));
      reminderTimers.delete(id);
    }
    
    console.log(`[scheduler] ✅ Сесія ${sessionType} завершена для ${id}`);
  }
};

export const cancelSessionReminder = (tgId) => {
  const id = String(tgId);
  
  if (reminderTimers.has(id)) {
    clearTimeout(reminderTimers.get(id));
    reminderTimers.delete(id);
    console.log(`[scheduler] 🔕 Нагадування скасовано для ${id}`);
  }
  
  if (activeSessions.has(id)) {
    activeSessions.delete(id);
    console.log(`[scheduler] 🚪 Сесія завершена для ${id}`);
  }
};

export const isSessionActive = (tgId) => {
  return activeSessions.has(String(tgId));
};

export const getActiveSession = (tgId) => {
  return activeSessions.get(String(tgId)) || null;
};

// Запуск планувальника
export const startScheduler = (bot) => {
  if (isSchedulerStarted) {
    console.log('[scheduler] ⏭️ Scheduler вже запущено');
    return;
  }

  console.log('[scheduler] 🚀 Запуск оптимізованого scheduler...');
  console.log(`[scheduler] Timezone: ${SCHEDULE.TIMEZONE}`);
  console.log(`[scheduler] Ранок: ${SCHEDULE.MORNING_TIME}`);
  console.log(`[scheduler] Вечір: ${SCHEDULE.EVENING_TIME}`);

  try {
    // Ранкові нагадування - 08:00
    const morningJob = cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, () => {
      sendMorningReminders(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });
    
    // Вечірні нагадування - 21:30
    const eveningJob = cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, () => {
      sendEveningReminders(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // Щотижневі звіти - неділя 19:00
    const weeklyJob = cron.schedule('0 19 * * 0', () => {
      sendWeeklyReports(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // Щомісячні звіти та колесо - 1 число 10:00
    const monthlyJob = cron.schedule(CRON_SCHEDULES.MONTHLY_WHEEL_CHECK, () => {
      sendMonthlyReports(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // Щоденна перевірка підписок - 09:00
    const subscriptionJob = cron.schedule(CRON_SCHEDULES.SUBSCRIPTION_CHECK, () => {
      checkExpiredSubscriptions();
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // Додаємо задачі до списку
    jobs.push(morningJob, eveningJob, weeklyJob, monthlyJob, subscriptionJob);
    isSchedulerStarted = true;

    console.log('✅ [scheduler] Оптимізований scheduler запущено');
    console.log(`📅 [scheduler] Ранкові: ${CRON_SCHEDULES.MORNING_QUESTIONS}`);
    console.log(`📅 [scheduler] Вечірні: ${CRON_SCHEDULES.EVENING_QUESTIONS}`);
    console.log(`📅 [scheduler] Щотижневі: неділя 19:00`);
    console.log(`📅 [scheduler] Щомісячні: 1 число 10:00`);
    console.log(`📅 [scheduler] Підписки: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка запуску scheduler:', error);
  }
};

export const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка scheduler...');
  
  jobs.forEach((job, index) => {
    try {
      job.destroy();
      console.log(`[scheduler] ✅ Зупинено задачу ${index + 1}`);
    } catch (error) {
      console.error(`[scheduler] ❌ Помилка зупинки задачі ${index + 1}:`, error);
    }
  });
  
  // Очищаємо всі таймери
  reminderTimers.forEach((timer, id) => {
    clearTimeout(timer);
    console.log(`[scheduler] 🔕 Скасовано нагадування для ${id}`);
  });
  
  jobs.length = 0;
  isSchedulerStarted = false;
  executionLocks.clear();
  activeSessions.clear();
  reminderTimers.clear();
  
  console.log('[scheduler] ✅ Scheduler зупинено');
};