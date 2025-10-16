// src/services/scheduler.js
// Планувальник автоматичних нагадувань: ранкові/вечірні/звіти/колесо/підписки

import cron from 'node-cron';
import { CRON_SCHEDULES, SCHEDULER_MESSAGES } from '../config/index.js';
import { tables, selectFromTable } from '../config/database.js';
import keyboards, { menuKeyboard } from '../utils/keyboards.js';

const TZ = 'Europe/Prague';
let jobs = [];

// ── helpers ───────────────────────────────────────────────────────────────────
const getActiveUsers = async () => {
  try {
    const formula = `AND({Status}='Active User', {Answer_Step}='COMPLETED')`;
    return await selectFromTable(tables.USERS, { filterByFormula: formula }).all();
  } catch (e) {
    console.error('[scheduler/getActiveUsers] ❌', e?.message || e);
    return [];
  }
};

const chatIdOf = (user) => String(user?.fields?.TG_id || '').trim() || null;
const nameOf = (user) => user?.fields?.['User Name'] || 'Користувач';

const safeSend = async (bot, tgId, text, extra) => {
  try {
    await bot.telegram.sendMessage(tgId, text, extra);
    return true;
  } catch (e) {
    console.error(`[scheduler] ❌ send ${tgId}:`, e?.message || e);
    return false;
  }
};

const broadcastToActive = async (bot, buildPayload) => {
  const users = await getActiveUsers();
  console.log(`[scheduler] 👥 Активних: ${users.length}`);
  for (const u of users) {
    const tgId = chatIdOf(u);
    if (!tgId) {
      console.warn('[scheduler] ⚠️ Пропуск: TG_id порожній');
      continue;
    }
    const payload = buildPayload(u, tgId);
    if (!payload) continue;
    await safeSend(bot, tgId, payload.text, payload.extra);
  }
};

// ── tasks ─────────────────────────────────────────────────────────────────────
const sendMorningQuestions = async (bot) => {
  console.log('🌞 [scheduler] Ранкові нотифікації…');
  await broadcastToActive(bot, (u) => ({
    text: SCHEDULER_MESSAGES.MORNING_SESSION_START(nameOf(u)),
    extra: keyboards.morningStartInline(),
  }));
};

const sendEveningQuestions = async (bot) => {
  console.log('🌙 [scheduler] Вечірні нотифікації…');
  await broadcastToActive(bot, (u) => ({
    text: SCHEDULER_MESSAGES.EVENING_SESSION_START(nameOf(u)), // ✅ fixed
    extra: keyboards.eveningStartInline(),
  }));
};

const sendWeeklyReports = async (bot) => {
  console.log('📊 [scheduler] Щотижневі звіти…');
  await broadcastToActive(bot, () => ({
    text: SCHEDULER_MESSAGES.WEEKLY_PROMPT,
    extra: menuKeyboard([
      { text: '📊 Переглянути звіт', callback_data: 'show_weekly_report' },
      { text: '⏭ Пізніше', callback_data: 'later_weekly' },
    ]),
  }));
};

const monthlyWheelCheck = async (bot) => {
  console.log('🎯 [scheduler] Щомісячне колесо…');
  await broadcastToActive(bot, (u) => ({
    text:
      `🎯 Привіт, ${nameOf(u)}!\n\n` +
      `Настав час оновити твоє *Колесо балансу*. Це допоможе побачити прогрес і перефокусуватися на наступний місяць.`,
    extra: menuKeyboard([
      { text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' },
      { text: '⏭ Пізніше', callback_data: 'later_wheel' },
    ]),
  }));
};
let subscriptionService = null;

const getSubscriptionService = async () => {
  if (!subscriptionService) {
    subscriptionService = (await import('../features/subscription/service.js')).default;
  }
  return subscriptionService;
};
/**
 * 🔔 Перевірка підписок:
 * 1) деактивація прострочених (в базі)
 * 2) нагадування тим, у кого завершується підписка (напр., за 1–3 дні)
 */
const checkSubscriptions = async (bot) => {
  try {
    console.log('💰 [scheduler] Перевірка підписок…');

    // 1) деактивуємо прострочені
    const service = await getSubscriptionService();
    const deactivated = await service.deactivateExpiredSubscriptions?.();
    if (typeof deactivated === 'number') {
      console.log(`💳 [scheduler] Деактивовано прострочених: ${deactivated}`);
    }

    // 2) надсилаємо нагадування (сьогодні-завтра)
    const expiringSoon = await service.getUsersWithExpiringSubscriptions?.(1);
    const expiringIn3 = await service.getUsersWithExpiringSubscriptions?.(3);

    const map = new Map();
    [...(expiringSoon || []), ...(expiringIn3 || [])].forEach((u) => map.set(u.TG_id, u));
    const users = [...map.values()];
    console.log(`💳 [scheduler] Нагадати користувачам: ${users.length}`);

    for (const u of users) {
      const tgId = u.TG_id;
      const planName = u['Active Subscription Plan'] || 'План';
      const endDate = u.End_Date
        ? new Date(u.End_Date).toLocaleDateString('uk-UA')
        : '—';

      const msg = `⏳ Підписка *${planName}* завершується ${endDate}.\n\n` +
                  `Щоб не втрачати доступ — продовжуй у один клік 👇`;

      await safeSend(bot, tgId, msg, keyboards.subscriptionExpiringKeyboard());
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (e) {
    console.error('[scheduler/checkSubscriptions] ❌', e?.message || e);
  }
};
// ── public API ────────────────────────────────────────────────────────────────
export const startScheduler = (bot) => {
  console.log('⏰ [scheduler] Старт…');

  // idempotent: якщо вже запущено — спочатку зупиняємо
  if (jobs.length) stopScheduler();

  try {
    jobs.push(
      cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, () => sendMorningQuestions(bot), { timezone: TZ }),
    );
    console.log(`[scheduler] ✅ Morning: ${CRON_SCHEDULES.MORNING_QUESTIONS}`);

    jobs.push(
      cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, () => sendEveningQuestions(bot), { timezone: TZ }),
    );
    console.log(`[scheduler] ✅ Evening: ${CRON_SCHEDULES.EVENING_QUESTIONS}`);

    jobs.push(
      cron.schedule(CRON_SCHEDULES.WEEKLY_REPORTS, () => sendWeeklyReports(bot), { timezone: TZ }),
    );
    console.log(`[scheduler] ✅ Weekly: ${CRON_SCHEDULES.WEEKLY_REPORTS}`);

    jobs.push(
      cron.schedule(CRON_SCHEDULES.MONTHLY_WHEEL_CHECK, () => monthlyWheelCheck(bot), { timezone: TZ }),
    );
    console.log(`[scheduler] ✅ Monthly: ${CRON_SCHEDULES.MONTHLY_WHEEL_CHECK}`);

    jobs.push(
      cron.schedule(CRON_SCHEDULES.SUBSCRIPTION_CHECK, () => checkSubscriptions(bot), { timezone: TZ }),
    );
    console.log(`[scheduler] ✅ Subs: ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);

    console.log(`[scheduler] ▶️ Активних задач: ${jobs.length}`);
  } catch (e) {
    console.error('[scheduler/startScheduler] ❌', e?.message || e);
    throw e;
  }
};

export const stopScheduler = () => {
  console.log('⏹️ [scheduler] Зупинка…');
  for (const j of jobs) {
    try { j.stop(); } catch (e) { console.error('[scheduler/stopScheduler] ❌', e?.message || e); }
  }
  jobs = [];
  console.log('[scheduler] ✅ Зупинено');
};

/** Нагадування неактивним (48+ год) */
export const checkInactiveUsers = async (bot) => {
  const now = new Date();
  const users = await getActiveUsers();

  for (const u of users) {
    const tgId = chatIdOf(u);
    if (!tgId) continue;

    const last = u?.fields?.Last_Activity ? new Date(u.fields.Last_Activity) : null;
    if (!last || Number.isNaN(last.getTime())) continue;

    const hours = Math.floor((now - last) / (1000 * 60 * 60));
    if (hours >= 48) {
      await safeSend(
        bot,
        tgId,
        '⏰ Привіт! Давно не бачились. Хочеш повернутись у ритм?',
        keyboards.morningStartInline(),
      );
    }
  }
};

console.log('✅ [services/scheduler] Scheduler завантажено');
