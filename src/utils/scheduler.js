// src/utils/scheduler.js 

import cron from 'node-cron';
import subscriptionController from '../controllers/subscriptionController.js';
import activityTracker from '../services/activityTracker.js';
import wheelBalanceService from '../services/wheelBalanceService.js'; // ✅ ПРАВИЛЬНИЙ ШЛЯХ
import keyboards from '../utils/keyboards.js';
import {
  SCHEDULE,
  CRON_SCHEDULES,
  SCHEDULER_MESSAGES,
  ANSWER_STEPS 
} from '../config/constants.js';
import userService from '../services/userService.js';

// ----------------- helpers -----------------
const jobs = [];
let isSchedulerStarted = false;
const activeSessions = new Map();
const reminderTimers = new Map();
const taskReminders = new Map();
const executionLocks = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const guardExecution = (type) => {
  const key = `${type}_${new Date().toISOString().slice(0, 16)}`;
  if (executionLocks.has(key)) {
    console.log(`[scheduler] ⏭️ Дублювання ${type} пропущено`);
    return false;
  }
  executionLocks.add(key);
  setTimeout(() => executionLocks.delete(key), 120_000);
  return true;
};

const isAccessActiveFallback = (user) => {
  if (!user) return false;
  try {
    if (typeof userService.hasActiveAccess === 'function') {
      return !!userService.hasActiveAccess(user);
    }
  } catch {}
  const a = (user['Active_Subscription_Status'] || '');
  const s = (user['Subscription Status'] || '').toLowerCase();
  return a.includes('✅') || s === 'active';
};

const fetchActiveUsers = async () => {
  if (typeof userService.getActiveUsers === 'function') {
    return await userService.getActiveUsers();
  }

  if (typeof userService.getAllUsers === 'function') {
    const all = await userService.getAllUsers();
    return (all || [])
      .map(u => ({
        ...u,
        TG_id: u.TG_id || u['TG_id'] || u['TG_ID'] || u['tg_id']
      }))
      .filter(u => !!u.TG_id && isAccessActiveFallback(u));
  }

  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const USERS_TBL = tables?.USERS || 'Users';

    const filterByFormula =
      'AND(' +
        'NOT({TG_id} = ""),' +
        'OR(' +
          'FIND("✅", {Active_Subscription_Status}) > 0,' +
          'LOWER({Subscription Status}) = "active"' +
        ')' +
      ')';

    const records = await base(USERS_TBL)
      .select({
        filterByFormula,
        pageSize: 100
      })
      .all();

    const users = records
      .map(r => r.fields)
      .map(f => ({
        ...f,
        TG_id: f.TG_id || f['TG_id'] || f['TG_ID'] || f['tg_id']
      }))
      .filter(u => !!u.TG_id);

    return users;
  } catch (e) {
    console.error('[scheduler] ❌ fetchActiveUsers fallback error:', e);
    return [];
  }
};

// ----------------- morning / evening -----------------
const sendMorningReminders = async (bot) => {
  if (!guardExecution('morning')) return;

  console.log(`[scheduler] 🌞 Ранкові нагадування`);
  try {
    const users = await fetchActiveUsers();
    console.log(`[scheduler] Активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;

      try {
        const name = user['User Name'] || 'Користувач';
        const completedToday = await checkMorningCompletion(tgId);
        
        if (completedToday) {
          console.log(`[scheduler] ✅ ${tgId} вже завершив ранкові питання`);
          
          // ✅ ДОДАЄМО ОПЦІЮ ПРОЙТИ ЩЕ РАЗ
          const text = 
            `🌞 Доброго ранку, ${name}!\n\n` +
            `✅ Ти вже пройшла ранкову рефлексію сьогодні.\n\n` +
            `Бажаєш пройти ще раз? (попередні відповіді будуть замінені)`;
          
          await bot.telegram.sendMessage(
            tgId,
            text,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔄 Пройти ще раз', callback_data: 'restart_morning' }],
                  [{ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }]
                ]
              }
            }
          );
          
          continue;
        }

        // ✅ ЗВИЧАЙНЕ НАГАДУВАННЯ ДЛЯ ТИХ, ХТО НЕ ЗАВЕРШИВ
        const text = SCHEDULER_MESSAGES.MORNING_SESSION_START(name);
        await bot.telegram.sendMessage(
          tgId,
          text,
          keyboards.morningStartInline?.() || undefined
        );

        markSessionActive(tgId, 'morning');
        scheduleSessionReminder(bot, tgId, SCHEDULER_MESSAGES.MORNING_REMINDER, 'morning');

      } catch (err) {
        console.error(`[scheduler] ❌ Помилка юзера ${tgId}:`, err);
      }

      await sleep(250);
    }
  } catch (e) {
    console.error('[scheduler] ❌ Помилка ранкових нагадувань:', e);
  }
};

const sendEveningReminders = async (bot) => {
  if (!guardExecution('evening')) return;

  console.log(`[scheduler] 🌙 ========== ВЕЧІРНІ НАГАДУВАННЯ ==========`);
  console.log(`[scheduler] 🕐 Поточний час: ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
  
  try {
    const users = await fetchActiveUsers();
    console.log(`[scheduler] 👥 Активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) {
        console.log(`[scheduler] ⚠️ Пропущено користувача без TG_id`);
        continue;
      }

      try {
        const name = user['User Name'] || 'Користувач';
        
        console.log(`[scheduler] 🔍 Перевірка ${tgId} (${name})...`);
        
        // ✅ ВИПРАВЛЕНО: перевірка завершення
        const completedToday = await checkEveningCompletion(tgId);
        
        if (completedToday) {
          console.log(`[scheduler] ✅ ${tgId} вже завершив вечірні питання`);
          
          // ✅ ПРОПОНУЄМО ПРОЙТИ ЩЕ РАЗ
          const text = 
            `🌙 Добрий вечір, ${name}!\n\n` +
            `✅ Ти вже пройшла вечірню рефлексію сьогодні.\n\n` +
            `Бажаєш пройти ще раз? (попередні відповіді будуть замінені)`;
          
          await bot.telegram.sendMessage(
            tgId,
            text,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔄 Пройти ще раз', callback_data: 'restart_evening' }],
                  [{ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }]
                ]
              }
            }
          );
          
          console.log(`[scheduler] 📤 Надіслано пропозицію повтору для ${tgId}`);
          continue;
        }

        // ✅ ПЕРЕВІРКА РАНКОВИХ (необов'язково)
        const hadMorning = await checkMorningCompletion(tgId);
        const baseText = SCHEDULER_MESSAGES.EVENING_SESSION_START(name);
        const note = hadMorning ? '' : `\n\n⚠️ Ти ще не пройшла ранкові питання сьогодні.`;
        
        console.log(`[scheduler] 📤 Надсилаємо вечірнє нагадування для ${tgId}`);
        console.log(`[scheduler] 🌞 Ранкові завершено: ${hadMorning ? 'ТАК' : 'НІ'}`);
        
        await bot.telegram.sendMessage(
          tgId,
          baseText + note,
          keyboards.eveningStartInline?.() || {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }],
                [{ text: '⏭ Пізніше', callback_data: 'later_evening' }]
              ]
            }
          }
        );

        markSessionActive(tgId, 'evening');
        scheduleSessionReminder(bot, tgId, SCHEDULER_MESSAGES.EVENING_REMINDER, 'evening');
        
        console.log(`[scheduler] ✅ Вечірнє нагадування надіслано ${tgId}`);

      } catch (err) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, err.message);
        console.error(`[scheduler] ❌ Stack:`, err.stack);
      }
      
      await sleep(250);
    }
    
    console.log(`[scheduler] 🌙 ========== ВЕЧІРНІ НАГАДУВАННЯ ЗАВЕРШЕНО ==========`);
    
  } catch (e) {
    console.error('[scheduler] ❌ КРИТИЧНА ПОМИЛКА вечірніх нагадувань:', e.message);
    console.error('[scheduler] ❌ Stack:', e.stack);
  }
};
// ----------------- session reminder (10 хв) -----------------
const scheduleSessionReminder = (bot, tgId, reminderText, sessionType) => {
  const id = String(tgId);

  // Скасовуємо попереднє нагадування
  if (reminderTimers.has(id)) {
    clearTimeout(reminderTimers.get(id));
    reminderTimers.delete(id);
    console.log(`[scheduler] 🔕 Скасовано попереднє нагадування для ${id}`);
  }

  const t = setTimeout(async () => {
    try {
      const session = activeSessions.get(id);
      
      // ✅ ПЕРЕВІРКА 1: Чи сесія ще активна?
      if (!session) {
        console.log(`[scheduler] ℹ️ Сесія для ${id} вже не активна, нагадування скасовано`);
        reminderTimers.delete(id);
        return;
      }
      
      // ✅ ПЕРЕВІРКА 2: Чи вже надіслано нагадування?
      if (session.reminded) {
        console.log(`[scheduler] ℹ️ Нагадування для ${id} вже надіслано`);
        reminderTimers.delete(id);
        return;
      }

      // ✅ ПЕРЕВІРКА 3: Чи користувач завершив сесію (перевірка Answer_Step)
      try {
        const user = await userService.getUserByTgId(id);
        if (user?.Answer_Step === 'completed' || user?.Answer_Step === ANSWER_STEPS.COMPLETED) {
          console.log(`[scheduler] ✅ Користувач ${id} вже завершив сесію, нагадування скасовано`);
          activeSessions.delete(id);
          reminderTimers.delete(id);
          return;
        }
      } catch (userCheckError) {
        console.error(`[scheduler] ⚠️ Помилка перевірки користувача ${id}:`, userCheckError);
        // Продовжуємо - краще надіслати зайве нагадування, ніж пропустити
      }

      // Надсилаємо нагадування
      await bot.telegram.sendMessage(
        id,
        reminderText,
        keyboards.sessionReminderInline?.(sessionType) || undefined
      );

      session.reminded = true;
      console.log(`[scheduler] 🔔 Нагадування сесії надіслано ${id}`);
      
    } catch (err) {
      console.error('[scheduler] ❌ Помилка session reminder:', err);
    } finally {
      reminderTimers.delete(id);
    }
  }, 10 * 60 * 1000); // 10 хвилин

  reminderTimers.set(id, t);
  console.log(`[scheduler] ⏰ Заплановано нагадування для ${id} через 10 хв`);
};
const markSessionActive = (tgId, type) => {
  activeSessions.set(String(tgId), { type, startTime: new Date(), reminded: false });
};

export const markSessionCompleted = (tgId, sessionType) => {
  const id = String(tgId);
  const s = activeSessions.get(id);
  if (s && s.type === sessionType) {
    activeSessions.delete(id);
    if (reminderTimers.has(id)) {
      clearTimeout(reminderTimers.get(id));
      reminderTimers.delete(id);
    }
    console.log(`[scheduler] ✅ Сесію ${sessionType} завершено для ${id}`);
  }
};

export const cancelSessionReminder = (tgId) => {
  const id = String(tgId);
  if (reminderTimers.has(id)) {
    clearTimeout(reminderTimers.get(id));
    reminderTimers.delete(id);
  }
  if (activeSessions.has(id)) activeSessions.delete(id);
  console.log(`[scheduler] 🔕 Нагадування/сесію скасовано для ${id}`);
};

export const isSessionActive = (tgId) => activeSessions.has(String(tgId));
export const getActiveSession = (tgId) => activeSessions.get(String(tgId)) || null;

// ----------------- SMART-нагадування -----------------
export const scheduleTaskReminders = async (bot, tgId, tasks) => {
  const id = String(tgId);

  if (taskReminders.has(id)) {
    taskReminders.get(id).forEach(clearTimeout);
    taskReminders.delete(id);
  }

  if (!Array.isArray(tasks) || tasks.length === 0) return;

  const timers = [];

  for (const task of tasks) {
    if (!task?.time || /будь-?коли/i.test(task.time)) continue;

    const m = String(task.time).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) continue;

    const [, H, M] = m;
    const taskTime = new Date();
    taskTime.setHours(parseInt(H, 10), parseInt(M, 10), 0, 0);

    const reminderAt = new Date(taskTime.getTime() - 5 * 60 * 1000);
    const dt = reminderAt.getTime() - Date.now();
    if (dt <= 0) continue;

    const t = setTimeout(async () => {
      try {
        const txt = SCHEDULER_MESSAGES.TASK_REMINDER(task);
        await bot.telegram.sendMessage(
          id,
          txt,
          keyboards.taskReminderInline?.() || undefined
        );
        console.log(`[scheduler] ✅ SMART-нагадування: ${id} — ${task.action}`);
      } catch (err) {
        console.error('[scheduler] ❌ SMART-нагадування помилка:', err);
      }
    }, dt);

    timers.push(t);
  }

  if (timers.length) taskReminders.set(id, timers);
  scheduleMidDayCheck(bot, id, tasks);
};

export const cancelTaskReminders = (tgId) => {
  const id = String(tgId);
  if (taskReminders.has(id)) {
    taskReminders.get(id).forEach(clearTimeout);
    taskReminders.delete(id);
    console.log(`[scheduler] 🔕 SMART-нагадування скасовано для ${id}`);
  }
};

const scheduleMidDayCheck = (bot, tgId, tasks) => {
  const id = String(tgId);
  const t = setTimeout(async () => {
    try {
      const completed = tasks.filter((t) => t.completed).length;
      const total = tasks.length;

      const txt = SCHEDULER_MESSAGES.MIDDAY_SUMMARY(completed, total);
      await bot.telegram.sendMessage(id, txt, keyboards.midDayCheckInline?.() || undefined);
      console.log(`[scheduler] 🕐 Серединне нагадування надіслано ${id}`);
    } catch (err) {
      console.error('[scheduler] ❌ MidDay помилка:', err);
    }
  }, 3 * 60 * 60 * 1000);

  if (!taskReminders.has(id)) taskReminders.set(id, []);
  taskReminders.get(id).push(t);
};

// ----------------- перевірки завершення -----------------
const checkMorningCompletion = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];

    const recs = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}", {Q_m_6} != "")`,
        maxRecords: 1
      })
      .firstPage();

    return recs.length > 0;
  } catch (e) {
    console.error('[checkMorningCompletion] ❌', e);
    return false;
  }
};

const checkEveningCompletion = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[checkEveningCompletion] 🔍 Перевірка для ${tgId}, дата: ${today}`);

    // ✅ ВИПРАВЛЕНО: правильна назва поля + додано логування
    const recs = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();

    if (recs.length === 0) {
      console.log(`[checkEveningCompletion] ❌ Запис не знайдено для ${tgId}`);
      return false;
    }
    
    const record = recs[0].fields;
    const hasQ_e_5 = !!record.Q_e_5;
    
    console.log(`[checkEveningCompletion] 📊 ${tgId}: Q_e_5 = "${record.Q_e_5 || 'ПУСТО'}", завершено: ${hasQ_e_5}`);
    
    return hasQ_e_5;
    
  } catch (e) {
    console.error('[checkEveningCompletion] ❌ Помилка:', e.message);
    console.error('[checkEveningCompletion] ❌ Stack:', e.stack);
    return false;
  }
};

// ----------------- фіналізація / щотижневе / щомісячне / підписки -----------------
const finalizeDailyStats = async () => {
  if (!guardExecution('daily_finalization')) return;

  console.log('[scheduler] 🌙 Фіналізація дня');
  try {
    const users = await fetchActiveUsers();
    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;
      try {
        await activityTracker.finalizeDay(tgId);
      } catch (e) {
        console.error(`[scheduler] ❌ Фіналізація ${tgId}:`, e);
      }
      await sleep(100);
    }
  } catch (e) {
    console.error('[scheduler] ❌ Фіналізація дня помилка:', e);
  }
};

const checkWeeklyActivity = async (bot) => {
  if (!guardExecution('weekly_activity')) return;

  console.log('[scheduler] 📊 Щотижнева активність');
  try {
    const users = await fetchActiveUsers();
    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;

      try {
        await activityTracker.checkWeeklyCompletionRate(tgId);
        const trigger = await activityTracker.checkInactivityTriggers(tgId);

        if (trigger?.showOffer) {
          await bot.telegram.sendMessage(tgId, trigger.message);
          await sleep(300);
          await subscriptionController.offerService(
            { from: { id: tgId }, reply: (msg, kb) => bot.telegram.sendMessage(tgId, msg, kb) },
            trigger.problemType,
            trigger
          );
        }
      } catch (e) {
        console.error(`[scheduler] ❌ Активність ${tgId}:`, e);
      }
      await sleep(150);
    }
  } catch (e) {
    console.error('[scheduler] ❌ Щотижнева активність помилка:', e);
  }
};

const sendWeeklyReports = async (bot) => {
  if (!guardExecution('weekly_reports')) return;

  console.log('[scheduler] 📊 Щотижневі звіти');
  try {
    const users = await fetchActiveUsers();
    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;

      try {
        await bot.telegram.sendMessage(
          tgId,
          SCHEDULER_MESSAGES.WEEKLY_PROMPT,
          keyboards.weeklyReportInline?.() || undefined
        );
      } catch (e) {
        console.error(`[scheduler] ❌ Weekly ${tgId}:`, e);
      }
      await sleep(150);
    }
  } catch (e) {
    console.error('[scheduler] ❌ Щотижневі звіти помилка:', e);
  }
};

const sendMonthlyReports = async (bot) => {
  if (!guardExecution('monthly')) return;

  console.log('[scheduler] 📅 Щомісячні звіти + колесо');
  try {
    // ✅ ВИКОРИСТОВУЄМО wheelBalanceService замість wheelBalanceController
    const sent = await wheelBalanceService.sendMonthlyWheelReminders(bot);
    console.log(`[scheduler] ✅ Wheel reminders: ${sent}`);

    // ✅ ВИКОРИСТОВУЄМО subscriptionController замість paymentService
    const exp = await subscriptionController.sendExpirationReminders(bot);
    console.log(`[scheduler] ✅ Sub expirations: ${exp}`);
  } catch (e) {
    console.error('[scheduler] ❌ Щомісячні операції помилка:', e);
  }
};

const checkExpiredSubscriptions = async () => {
  if (!guardExecution('subscription_check')) return;

  console.log('[scheduler] 💰 Перевірка підписок');
  try {
    // ✅ Динамічний імпорт для уникнення циклічних залежностей
    const { default: paymentService } = await import('../auth/services/paymentService.js');
    const n = await paymentService.deactivateExpiredSubscriptions();
    console.log(`[scheduler] ✅ Деактивовано: ${n}`);
  } catch (e) {
    console.error('[scheduler] ❌ Перевірка підписок помилка:', e);
  }
};

// ----------------- запуск / зупинка -----------------
export const startScheduler = (bot) => {
  if (isSchedulerStarted) {
    console.log('[scheduler] ⏭️ Уже запущено');
    return;
  }

  console.log('[scheduler] 🚀 Старт');
  console.log(`[scheduler] TZ: ${SCHEDULE.TIMEZONE}`);
  console.log(`[scheduler] Ранок: ${SCHEDULE.MORNING_TIME} -> ${CRON_SCHEDULES.MORNING_QUESTIONS}`);
  console.log(`[scheduler] Вечір: ${SCHEDULE.EVENING_TIME} -> ${CRON_SCHEDULES.EVENING_QUESTIONS}`);

  try {
    const morningJob = cron.schedule(
      CRON_SCHEDULES.MORNING_QUESTIONS,
      () => sendMorningReminders(bot),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

    const eveningJob = cron.schedule(
      CRON_SCHEDULES.EVENING_QUESTIONS,
      () => sendEveningReminders(bot),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

    const weeklyJob = cron.schedule(
      CRON_SCHEDULES.WEEKLY_REPORTS,
      () => sendWeeklyReports(bot),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

    const weeklyActivityJob = cron.schedule(
      CRON_SCHEDULES.WEEKLY_ACTIVITY,
      () => checkWeeklyActivity(bot),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

    const monthlyJob = cron.schedule(
      CRON_SCHEDULES.MONTHLY_WHEEL_CHECK,
      () => sendMonthlyReports(bot),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

    const subscriptionJob = cron.schedule(
      CRON_SCHEDULES.SUBSCRIPTION_CHECK,
      () => checkExpiredSubscriptions(),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

    const dailyFinalizationJob = cron.schedule(
      CRON_SCHEDULES.DAILY_FINALIZATION,
      () => finalizeDailyStats(),
      { timezone: SCHEDULE.TIMEZONE, scheduled: true }
    );

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

    console.log('✅ [scheduler] Запущено');
    console.log(`📅 Ранкові: ${CRON_SCHEDULES.MORNING_QUESTIONS}`);
    console.log(`📅 Вечірні: ${CRON_SCHEDULES.EVENING_QUESTIONS}`);
    console.log(`📅 Weekly: ${CRON_SCHEDULES.WEEKLY_REPORTS}, activity: ${CRON_SCHEDULES.WEEKLY_ACTIVITY}`);
    console.log(`📅 Monthly: ${CRON_SCHEDULES.MONTHLY_WHEEL_CHECK}`);
    console.log(`📅 Subs: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);
    console.log(`📅 Daily finalization: ${CRON_SCHEDULES.DAILY_FINALIZATION}`);
  } catch (e) {
    console.error('[scheduler] ❌ Помилка старту:', e);
  }
};

// ✅ ВИПРАВЛЕНО: j.stop() замість j.destroy()
export const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка…');

  jobs.forEach((j, i) => {
    try {
      if (j && typeof j.stop === 'function') {
        j.stop(); // ✅ ПРАВИЛЬНИЙ МЕТОД для node-cron
        console.log(`[scheduler] ✅ Зупинено задачу #${i + 1}`);
      }
    } catch (e) {
      console.error(`[scheduler] ❌ Помилка зупинки #${i + 1}:`, e);
    }
  });

  reminderTimers.forEach(clearTimeout);
  taskReminders.forEach((arr) => arr.forEach(clearTimeout));

  jobs.length = 0;
  isSchedulerStarted = false;
  executionLocks.clear();
  activeSessions.clear();
  reminderTimers.clear();
  taskReminders.clear();

  console.log('[scheduler] ✅ Зупинено');
};