// src/utils/scheduler.js - ФІНАЛЬНА ВЕРСІЯ З УСІМА ФУНКЦІЯМИ

import cron from 'node-cron';
import userService from '../services/userService.js';
import paymentService from '../auth/services/paymentService.js';
import wheelBalanceController from '../controllers/wheelBalanceController.js';
import activityTracker from '../services/activityTracker.js';
import subscriptionController from '../controllers/subscriptionController.js';
import { CRON_SCHEDULES, SCHEDULE } from '../config/constants.js';

const jobs = [];
let isSchedulerStarted = false;

// Відстеження активних сесій для нагадувань
const activeSessions = new Map();
const reminderTimers = new Map();
const taskReminders = new Map();

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

// ===== РАНКОВІ НАГАДУВАННЯ =====
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
        const completedToday = await checkMorningCompletion(tgId);
        if (completedToday) {
          console.log(`[scheduler] ✅ ${tgId} вже завершив ранкові питання`);
          continue;
        }

        await sendMorningSession(bot, tgId, name);
        scheduleSessionReminder(bot, tgId, 'Ранкова рефлексія', 'morning');
        
        console.log(`[scheduler] ✅ Ранкове нагадування надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, userError.message);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка ранкових нагадувань:', error);
  }
};

// ===== ВЕЧІРНІ НАГАДУВАННЯ =====
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
        const completedToday = await checkEveningCompletion(tgId);
        if (completedToday) {
          console.log(`[scheduler] ✅ ${tgId} вже завершив вечірні питання`);
          continue;
        }

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
        
        scheduleSessionReminder(bot, tgId, 'Вечірня рефлексія', 'evening');
        
        console.log(`[scheduler] ✅ Вечірнє нагадування надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, userError.message);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка вечірніх нагадувань:', error);
  }
};

// ===== ВІДПРАВКА РАНКОВОЇ СЕСІЇ =====
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

  activeSessions.set(String(tgId), {
    type: 'morning',
    startTime: new Date(),
    reminded: false
  });
};

// ===== НАГАДУВАННЯ ЧЕРЕЗ 10 ХВИЛИН =====
const scheduleSessionReminder = (bot, tgId, sessionName, sessionType) => {
  const id = String(tgId);
  
  if (reminderTimers.has(id)) {
    clearTimeout(reminderTimers.get(id));
    reminderTimers.delete(id);
  }
  
  const timer = setTimeout(async () => {
    try {
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
      
      if (session) {
        session.reminded = true;
      }
      
      console.log(`[scheduler] 🔔 Нагадування надіслано ${id} про ${sessionName}`);
      
    } catch (error) {
      console.error('[scheduleSessionReminder] Помилка:', error);
    } finally {
      reminderTimers.delete(id);
    }
  }, 10 * 60 * 1000);
  
  reminderTimers.set(id, timer);
};

// ===== SMART-НАГАДУВАННЯ ПРО ЗАДАЧІ =====
export const scheduleTaskReminders = async (bot, tgId, tasks) => {
  const id = String(tgId);
  
  console.log(`[scheduler] 📋 Планування SMART-нагадувань для ${id}`);
  console.log(`[scheduler] Задач: ${tasks?.length || 0}`);
  
  if (taskReminders.has(id)) {
    const oldTimers = taskReminders.get(id);
    oldTimers.forEach(timer => clearTimeout(timer));
    taskReminders.delete(id);
  }
  
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    console.log(`[scheduler] ⚠️ Немає задач для планування`);
    return;
  }
  
  const timers = [];
  
  for (const task of tasks) {
    if (!task.time || task.time === 'будь-коли') continue;
    
    try {
      const timeMatch = task.time.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) {
        console.log(`[scheduler] ⚠️ Некоректний формат часу: ${task.time}`);
        continue;
      }
      
      const [_, hours, minutes] = timeMatch;
      const taskTime = new Date();
      taskTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const reminderTime = new Date(taskTime);
      reminderTime.setMinutes(reminderTime.getMinutes() - 5);
      
      const now = new Date();
      const msUntilReminder = reminderTime.getTime() - now.getTime();
      
      if (msUntilReminder > 0) {
        const timer = setTimeout(async () => {
          try {
            await bot.telegram.sendMessage(id, 
              `⏰ НАГАДУВАННЯ\n\n` +
              `Через 5 хв стартує:\n` +
              `${task.action}\n\n` +
              `🎯 Результат: ${task.result_metric}\n` +
              `⏱ Тривалість: ${task.duration_min} хв\n\n` +
              `💪 Тримай фокус!`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '✅ Готовий', callback_data: 'task_start' }],
                    [{ text: '⏭ Перенести', callback_data: 'task_reschedule' }]
                  ]
                }
              }
            );
            
            console.log(`[scheduler] ✅ SMART-нагадування надіслано ${id}: ${task.action}`);
            
          } catch (error) {
            console.error('[scheduleTaskReminders] Помилка відправки:', error);
          }
        }, msUntilReminder);
        
        timers.push(timer);
        console.log(`[scheduler] ⏰ Заплановано нагадування на ${reminderTime.toLocaleTimeString('uk-UA')}: ${task.action}`);
      }
      
    } catch (parseError) {
      console.error(`[scheduler] ❌ Помилка парсингу задачі:`, parseError);
    }
  }
  
  if (timers.length > 0) {
    taskReminders.set(id, timers);
    console.log(`[scheduler] 📌 Збережено ${timers.length} SMART-нагадувань для ${id}`);
  }
  
  scheduleMidDayCheck(bot, id, tasks);
};

// ===== СЕРЕДНЄ НАГАДУВАННЯ =====
const scheduleMidDayCheck = (bot, tgId, tasks) => {
  const id = String(tgId);
  const threeHours = 3 * 60 * 60 * 1000;
  
  const timer = setTimeout(async () => {
    try {
      const completedCount = tasks.filter(t => t.completed).length;
      const totalCount = tasks.length;
      
      let message = '';
      
      if (completedCount === 0) {
        message = 
          `⏰ СЕРЕДИНА ДНЯ\n\n` +
          `Як справи з планом на день?\n\n` +
          `📋 Заплановано: ${totalCount} дій\n` +
          `✅ Виконано: ${completedCount}\n\n` +
          `💡 Почни з найкоротшої дії — 10 хв. Інерція зробить своє!`;
      } else if (completedCount < totalCount) {
        message = 
          `⏰ СЕРЕДИНА ДНЯ\n\n` +
          `Хороший темп! 💪\n\n` +
          `✅ Виконано: ${completedCount}/${totalCount}\n` +
          `📋 Залишилось: ${totalCount - completedCount}\n\n` +
          `Продовжуй у тому ж дусі!`;
      } else {
        message = 
          `🎉 ЧУДОВО!\n\n` +
          `Всі дії виконано: ${totalCount}/${totalCount}\n\n` +
          `💪 Сильний темп! Тримаємо курс.`;
      }
      
      await bot.telegram.sendMessage(id, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Деталі', callback_data: 'show_task_details' }],
            [{ text: '🔄 Оновити план', callback_data: 'update_tasks' }]
          ]
        }
      });
      
      console.log(`[scheduler] 🕐 Середнє нагадування надіслано ${id}`);
      
    } catch (error) {
      console.error('[scheduleMidDayCheck] Помилка:', error);
    }
  }, threeHours);
  
  if (!taskReminders.has(id)) {
    taskReminders.set(id, []);
  }
  taskReminders.get(id).push(timer);
  
  console.log(`[scheduler] 🕐 Заплановано середнє нагадування через 3 год для ${id}`);
};

// ===== СКАСУВАННЯ TASK-НАГАДУВАНЬ =====
export const cancelTaskReminders = (tgId) => {
  const id = String(tgId);
  
  if (taskReminders.has(id)) {
    const timers = taskReminders.get(id);
    timers.forEach(timer => clearTimeout(timer));
    taskReminders.delete(id);
    console.log(`[scheduler] 🔕 SMART-нагадування скасовано для ${id}`);
  }
};

// ===== ПЕРЕВІРКА ЗАВЕРШЕННЯ =====
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

// ===== ✅ ЩОДЕННА ФІНАЛІЗАЦІЯ О 23:59 =====
const finalizeDailyStats = async () => {
  if (!guardExecution('daily_finalization')) return;
  
  console.log(`[scheduler] 🌙 Фіналізація дня - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    
    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;
      
      try {
        await activityTracker.finalizeDay(tgId);
        console.log(`[scheduler] ✅ День фіналізовано для ${tgId}`);
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка фіналізації для ${tgId}:`, error);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка щоденної фіналізації:', error);
  }
};

// ===== ✅ ЩОТИЖНЕВА ПЕРЕВІРКА АКТИВНОСТІ =====
const checkWeeklyActivity = async (bot) => {
  if (!guardExecution('weekly_activity')) return;
  
  console.log(`[scheduler] 📊 Щотижнева перевірка активності - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    
    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;
      
      try {
        await activityTracker.checkWeeklyCompletionRate(tgId);
        
        const trigger = await activityTracker.checkInactivityTriggers(tgId);
        
        if (trigger && trigger.showOffer) {
          await bot.telegram.sendMessage(tgId, trigger.message);
          await new Promise(r => setTimeout(r, 2000));
          
          await subscriptionController.offerService({ 
            from: { id: tgId },
            reply: (msg, kb) => bot.telegram.sendMessage(tgId, msg, kb)
          }, trigger.problemType, trigger);
          
          console.log(`[scheduler] 💡 Пропозицію показано ${tgId}: ${trigger.problemType}`);
        }
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка перевірки активності ${tgId}:`, userError);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка щотижневої перевірки:', error);
  }
};

// ===== ЩОТИЖНЕВІ ЗВІТИ =====
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

// ===== ЩОМІСЯЧНІ ЗВІТИ =====
const sendMonthlyReports = async (bot) => {
  if (!guardExecution('monthly')) return;
  
  console.log(`[scheduler] 📅 Щомісячні звіти та колесо балансу - ${new Date().toLocaleString()}`);
  
  try {
    const sentReminders = await wheelBalanceController.checkMonthlyWheelNeed(bot);
    console.log(`[scheduler] ✅ Надіслано ${sentReminders} щомісячних нагадувань про колесо`);
    
    const expiredCount = await paymentService.checkExpiringSubscriptions(bot);
    console.log(`[scheduler] ✅ Надіслано ${expiredCount} нагадувань про підписки`);
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка щомісячних операцій:', error);
  }
};

// ===== ПЕРЕВІРКА ПІДПИСОК =====
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

// ===== УПРАВЛІННЯ СЕСІЯМИ =====
export const markSessionCompleted = (tgId, sessionType) => {
  const id = String(tgId);
  const session = activeSessions.get(id);
  
  if (session && session.type === sessionType) {
    activeSessions.delete(id);
    
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

// ===== ЗАПУСК ПЛАНУВАЛЬНИКА =====
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
    const morningJob = cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, () => {
      sendMorningReminders(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });
    
    const eveningJob = cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, () => {
      sendEveningReminders(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    const weeklyJob = cron.schedule('0 19 * * 0', () => {
      sendWeeklyReports(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // ✅ ЩОТИЖНЕВА ПЕРЕВІРКА АКТИВНОСТІ
    const weeklyActivityJob = cron.schedule('0 20 * * 0', () => {
      checkWeeklyActivity(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    const monthlyJob = cron.schedule(CRON_SCHEDULES.MONTHLY_WHEEL_CHECK, () => {
      sendMonthlyReports(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    const subscriptionJob = cron.schedule(CRON_SCHEDULES.SUBSCRIPTION_CHECK, () => {
      checkExpiredSubscriptions();
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // ✅ ЩОДЕННА ФІНАЛІЗАЦІЯ О 23:59
    const dailyFinalizationJob = cron.schedule('59 23 * * *', () => {
      finalizeDailyStats();
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    jobs.push(
      morningJob, 
      eveningJob, 
      weeklyJob, 
      weeklyActivityJob,
      monthlyJob, 
      subscriptionJob,
      dailyFinalizationJob
    );
    
    isSchedulerStarted = true;

    console.log('✅ [scheduler] Оптимізований scheduler запущено');
    console.log(`📅 [scheduler] Ранкові: ${CRON_SCHEDULES.MORNING_QUESTIONS}`);
    console.log(`📅 [scheduler] Вечірні: ${CRON_SCHEDULES.EVENING_QUESTIONS}`);
    console.log(`📅 [scheduler] Щотижневі звіти: неділя 19:00`);
    console.log(`📅 [scheduler] Щотижнева активність: неділя 20:00`);
    console.log(`📅 [scheduler] Щомісячні: 1 число 10:00`);
    console.log(`📅 [scheduler] Підписки: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);
    console.log(`📅 [scheduler] Фіналізація дня: 23:59`);
    console.log(`📅 [scheduler] ✅ SMART-нагадування увімкнено`);
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка запуску scheduler:', error);
  }
};

// ===== ЗУПИНКА ПЛАНУВАЛЬНИКА =====
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
  
  reminderTimers.forEach((timer, id) => {
    clearTimeout(timer);
    console.log(`[scheduler] 🔕 Скасовано нагадування для ${id}`);
  });
  
  taskReminders.forEach((timers, id) => {
    timers.forEach(timer => clearTimeout(timer));
    console.log(`[scheduler] 🔕 Скасовано SMART-нагадування для ${id}`);
  });
  
  jobs.length = 0;
  isSchedulerStarted = false;
  executionLocks.clear();
  activeSessions.clear();
  reminderTimers.clear();
  taskReminders.clear();
  
  console.log('[scheduler] ✅ Scheduler зупинено');
};