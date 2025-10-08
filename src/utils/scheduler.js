// src/utils/scheduler.js
import cron from 'node-cron';
import subscriptionController from '../controllers/subscriptionController.js';
import activityTracker from '../services/activityTracker.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import keyboards from '../utils/keyboards.js';
import {
  SCHEDULE,
  CRON_SCHEDULES,
  SCHEDULER_MESSAGES,
  ANSWER_STEPS
} from '../config/constants.js';
import userService from '../services/userService.js';

// ----------------- helpers / state -----------------
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

// fallback перевірка доступу
const isAccessActiveFallback = (user) => {
  if (!user) return false;
  try {
    if (typeof userService.hasActiveAccess === 'function') {
      return !!userService.hasActiveAccess(user);
    }
  } catch (e) {
    // ignore
  }
  const a = (user['Active_Subscription_Status'] || '');
  const s = (user['Subscription Status'] || '').toLowerCase();
  return a.includes('✅') || s === 'active';
};

// отримати список користувачів із сервісу / бази
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

  // fallback: прямий доступ до airtable-like бази
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

    return records.map(r => ({
      ...r.fields,
      TG_id: r.fields.TG_id || r.fields['TG_id'] || r.fields['TG_ID'] || r.fields['tg_id']
    })).filter(u => !!u.TG_id);

  } catch (e) {
    console.error('[scheduler] ❌ fetchActiveUsers fallback error:', e);
    return [];
  }
};

// ----------------- morning / evening reminders -----------------
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
          // якщо вже пройшов — запропонувати пройти ще раз або відхилити
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
  console.log(`[scheduler] 🌙 ВЕЧІРНІ НАГАДУВАННЯ`);
  try {
    const users = await fetchActiveUsers();
    console.log(`[scheduler] 👥 Активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;

      try {
        const name = user['User Name'] || 'Користувач';
        const completedToday = await checkEveningCompletion(tgId);

        if (completedToday) {
          const text =
            `🌙 Добрий вечір, ${name}!\n\n` +
            `✅ Ти вже пройшла вечірню рефлексію сьогодні.\n\n` +
            `Бажаєш пройти ще раз? (попередні відповіді будуть замінені)`;

          await bot.telegram.sendMessage(tgId, text, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Пройти ще раз', callback_data: 'restart_evening' }],
                [{ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }]
              ]
            }
          });

          await sleep(250);
          continue;
        }

        const hadMorning = await checkMorningCompletion(tgId);
        const text = SCHEDULER_MESSAGES.EVENING_SESSION_START(name) +
                     (hadMorning ? '' : `\n\n⚠️ Ти ще не пройшла ранкові питання сьогодні.`);

        await bot.telegram.sendMessage(
          tgId,
          text,
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

      } catch (err) {
        console.error(`[scheduler] ❌ Помилка для ${tgId}:`, err?.message || err);
      }

      await sleep(250);
    }
  } catch (e) {
    console.error('[scheduler] ❌ КРИТИЧНА ПОМИЛКА:', e?.message || e);
  }
};

// ----------------- session reminder (10 хв) -----------------
const scheduleSessionReminder = (bot, tgId, reminderText, sessionType) => {
  const id = String(tgId);

  // clear previous
  if (reminderTimers.has(id)) {
    try { clearTimeout(reminderTimers.get(id)); } catch {}
    reminderTimers.delete(id);
  }

  const t = setTimeout(async () => {
    try {
      const session = activeSessions.get(id);
      if (!session) {
        reminderTimers.delete(id);
        return;
      }
      if (session.reminded) {
        reminderTimers.delete(id);
        return;
      }

      const user = await userService.getUserByTgId(id);
      if (user?.Answer_Step === 'completed' || user?.Answer_Step === ANSWER_STEPS.COMPLETED) {
        activeSessions.delete(id);
        reminderTimers.delete(id);
        return;
      }

      await bot.telegram.sendMessage(
        id,
        reminderText,
        keyboards.sessionReminderInline?.(sessionType) || undefined
      );

      session.reminded = true;
      reminderTimers.delete(id);

    } catch (err) {
      console.error('[scheduler] ❌ Помилка session reminder:', err);
      try { reminderTimers.delete(id); } catch {}
    }
  }, 10 * 60 * 1000);

  reminderTimers.set(id, t);
};

const markSessionActive = (tgId, type) => {
  activeSessions.set(String(tgId), { type, startTime: new Date(), reminded: false });
};

export const markSessionCompleted = (tgId, sessionType) => {
  const id = String(tgId);
  if (activeSessions.has(id)) {
    activeSessions.delete(id);
  }
  if (reminderTimers.has(id)) {
    try { clearTimeout(reminderTimers.get(id)); } catch {}
    reminderTimers.delete(id);
  }
};

export const cancelSessionReminder = (tgId) => {
  const id = String(tgId);
  if (reminderTimers.has(id)) {
    try { clearTimeout(reminderTimers.get(id)); } catch {}
    reminderTimers.delete(id);
  }
  activeSessions.delete(id);
};

export const isSessionActive = (tgId) => activeSessions.has(String(tgId));
export const getActiveSession = (tgId) => activeSessions.get(String(tgId)) || null;

// ----------------- SMART task reminders -----------------
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
        const txt = typeof SCHEDULER_MESSAGES.TASK_REMINDER === 'function'
          ? SCHEDULER_MESSAGES.TASK_REMINDER(task)
          : `⏰ Нагадування: ${task.title || task.action || 'Задача'}`;
        await bot.telegram.sendMessage(id, txt, keyboards.taskReminderInline?.(task.id) || undefined);
      } catch (err) {
        console.error('[scheduler] ❌ task reminder error', err?.message || err);
      }
    }, dt);

    timers.push(t);
  }

  if (timers.length > 0) taskReminders.set(id, timers);
};

// ----------------- checks (delegate to activityTracker) -----------------
export const checkMorningCompletion = async (tgId) => {
  if (activityTracker && typeof activityTracker.checkDailyCompletion === 'function') {
    try { return await activityTracker.checkDailyCompletion(tgId, 'morning'); } catch (e) {}
  }
  // fallback - try internal check
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
    return false;
  }
};

export const checkEveningCompletion = async (tgId) => {
  if (activityTracker && typeof activityTracker.checkDailyCompletion === 'function') {
    try { return await activityTracker.checkDailyCompletion(tgId, 'evening'); } catch (e) {}
  }
  // fallback to DB check
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    const recs = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}", OR({Q_e_5} != "", {Current_Activity} = "evening_completed"))`,
        maxRecords: 1
      })
      .firstPage();
    return recs.length > 0;
  } catch (e) {
    return false;
  }
};

// ----------------- weekly / monthly / finalization / subscription helpers -----------------
const finalizeDailyStats = async () => {
  if (!guardExecution('daily_finalization')) return;
  console.log('[scheduler] 🌙 Фіналізація дня');
  try {
    const users = await fetchActiveUsers();
    for (const user of users) {
      const tgId = user['TG_id'];
      if (!tgId) continue;
      try {
        if (activityTracker && typeof activityTracker.finalizeDay === 'function') {
          await activityTracker.finalizeDay(tgId);
        }
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
        if (activityTracker && typeof activityTracker.checkWeeklyCompletionRate === 'function') {
          await activityTracker.checkWeeklyCompletionRate(tgId);
        }
        if (activityTracker && typeof activityTracker.checkInactivityTriggers === 'function') {
          const trigger = await activityTracker.checkInactivityTriggers(tgId);
          if (trigger?.showOffer) {
            await bot.telegram.sendMessage(tgId, trigger.message);
            await sleep(300);
            // delegate offer
            await subscriptionController.offerService(
              { from: { id: tgId }, reply: (msg, kb) => bot.telegram.sendMessage(tgId, msg, kb) },
              trigger.problemType,
              trigger
            );
          }
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
    // wheelBalanceService may implement sending monthly reminders
    try {
      if (wheelBalanceService && typeof wheelBalanceService.sendMonthlyWheelReminders === 'function') {
        await wheelBalanceService.sendMonthlyWheelReminders(bot);
      }
    } catch (e) {
      console.error('[scheduler] ❌ wheelBalanceService error:', e);
    }

    try {
      if (subscriptionController && typeof subscriptionController.sendExpirationReminders === 'function') {
        await subscriptionController.sendExpirationReminders(bot);
      }
    } catch (e) {
      console.error('[scheduler] ❌ subscriptionController.sendExpirationReminders error:', e);
    }
  } catch (e) {
    console.error('[scheduler] ❌ Щомісячні операції помилка:', e);
  }
};

const checkExpiredSubscriptions = async () => {
  if (!guardExecution('subscription_check')) return;
  console.log('[scheduler] 💰 Перевірка підписок');
  try {
    // dynamic import to avoid circular deps
    try {
      const { default: paymentService } = await import('../auth/services/paymentService.js');
      if (paymentService && typeof paymentService.deactivateExpiredSubscriptions === 'function') {
        const n = await paymentService.deactivateExpiredSubscriptions();
        console.log(`[scheduler] ✅ Деактивовано: ${n}`);
      }
    } catch (e) {
      console.error('[scheduler] ❌ Перевірка підписок (paymentService) помилка:', e?.message || e);
    }
  } catch (e) {
    console.error('[scheduler] ❌ Перевірка підписок помилка:', e);
  }
};

// ----------------- utility: validate cron pattern -----------------
const isValidCronPattern = (p) => {
  if (typeof p !== 'string') return false;
  // very small validation: at least 5 space-separated fields (minute hour day month weekday)
  const parts = p.trim().split(/\s+/);
  return parts.length >= 5;
};

// ----------------- start / stop scheduler -----------------
export const startScheduler = (bot) => {
  if (isSchedulerStarted) {
    console.log('[scheduler] ⏭️ Уже запущено');
    return;
  }

  console.log('[scheduler] 🏁 Запуск cron');

  const scheduleAndPush = (name, pattern, fn) => {
    if (!isValidCronPattern(pattern)) {
      console.error(`[scheduler] ❌ ${name} pattern не рядок або не валідний:`, pattern);
      return null;
    }
    try {
      const job = cron.schedule(pattern, () => {
        try { fn(bot); } catch (e) { console.error(`[scheduler] ❌ Error in job ${name}:`, e); }
      }, { timezone: SCHEDULE.TIMEZONE, scheduled: true });
      jobs.push(job);
      console.log(`[scheduler] ✅ Job scheduled: ${name} -> ${pattern}`);
      return job;
    } catch (e) {
      console.error(`[scheduler] ❌ Не вдалося створити job ${name}:`, e?.message || e);
      return null;
    }
  };

  try {
    scheduleAndPush('morning_questions', CRON_SCHEDULES.MORNING_QUESTIONS, sendMorningReminders);
    scheduleAndPush('evening_questions', CRON_SCHEDULES.EVENING_QUESTIONS, sendEveningReminders);

    if (CRON_SCHEDULES.WEEKLY_REPORTS) scheduleAndPush('weekly_reports', CRON_SCHEDULES.WEEKLY_REPORTS, sendWeeklyReports);
    if (CRON_SCHEDULES.WEEKLY_ACTIVITY) scheduleAndPush('weekly_activity', CRON_SCHEDULES.WEEKLY_ACTIVITY, checkWeeklyActivity);
    if (CRON_SCHEDULES.MONTHLY_WHEEL_CHECK) scheduleAndPush('monthly_wheel', CRON_SCHEDULES.MONTHLY_WHEEL_CHECK, sendMonthlyReports);
    if (CRON_SCHEDULES.SUBSCRIPTION_CHECK) scheduleAndPush('subscription_check', CRON_SCHEDULES.SUBSCRIPTION_CHECK, checkExpiredSubscriptions);
    if (CRON_SCHEDULES.DAILY_FINALIZATION) scheduleAndPush('daily_finalization', CRON_SCHEDULES.DAILY_FINALIZATION, finalizeDailyStats);
  } catch (e) {
    console.error('[scheduler] ❌ Помилка при плануванні задач:', e);
  }

  isSchedulerStarted = true;
  console.log('[scheduler] ✅ Планувальник активовано');
};

export const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка планувальника');
  try {
    jobs.forEach((j, i) => {
      try {
        if (j && typeof j.stop === 'function') {
          j.stop();
          console.log(`[scheduler] ✅ Зупинено задачу #${i + 1}`);
        }
      } catch (e) {
        console.error(`[scheduler] ❌ Помилка зупинки #${i + 1}:`, e);
      }
    });
  } catch (e) {
    console.error('[scheduler] ❌ Помилка при зупинці:', e);
  }

  // clear timers
  reminderTimers.forEach(t => { try { clearTimeout(t); } catch {} });
  taskReminders.forEach(arr => arr.forEach(t => { try { clearTimeout(t); } catch {} }));

  jobs.length = 0;
  isSchedulerStarted = false;
  executionLocks.clear();
  activeSessions.clear();
  reminderTimers.clear();
  taskReminders.clear();

  console.log('[scheduler] ⏹️ Scheduler зупинено');
};