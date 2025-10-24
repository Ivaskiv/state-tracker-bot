// src/services/scheduler.js — USE CONSTANTS

import cron from 'node-cron';
import logger from '../utils/logger.js';
import keyboards from '../utils/keyboards.js';
import { getBase, tables } from '../config/database.js';
import subscriptionController from '../features/subscription/controller.js';
import { CRON_SCHEDULES, SCHEDULE, SCHEDULER_MESSAGES } from '../config/constants.js';

const base = getBase();
const TZ = SCHEDULE.TIMEZONE; // ✅ ONE SOURCE OF TRUTH

let tasks = [];

const pushTask = (task) => {
  tasks.push(task);
  return task;
};

// ─────────────────────────────────────────────────────────────────
// 🌞 MORNING QUESTIONS (використовує CRON_SCHEDULES.MORNING_QUESTIONS)
// ─────────────────────────────────────────────────────────────────

export const scheduleMorningReminders = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, async () => {
      try {
        logger.info(`🌞 [scheduler] Ранкові нагадування (${SCHEDULE.MORNING_TIME})…`);

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          const userName = user.fields['User Name'] || 'Користувач';
          
          try {
            await bot.telegram.sendMessage(
              tgId,
              SCHEDULER_MESSAGES.MORNING_SESSION_START(userName),
              { 
                parse_mode: 'Markdown',
                ...keyboards.morningStartInline()
              }
            );
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Morning ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Morning done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleMorningReminders:', e.message);
      }
    }, { timezone: TZ })
  );

// ─────────────────────────────────────────────────────────────────
// 🌙 EVENING QUESTIONS (використовує CRON_SCHEDULES.EVENING_QUESTIONS)
// ─────────────────────────────────────────────────────────────────

export const scheduleEveningReminders = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, async () => {
      try {
        logger.info(`🌙 [scheduler] Вечірні нагадування (${SCHEDULE.EVENING_TIME})…`);

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          const userName = user.fields['User Name'] || 'Користувач';
          
          try {
            await bot.telegram.sendMessage(
              tgId,
              SCHEDULER_MESSAGES.EVENING_SESSION_START(userName),
              { 
                parse_mode: 'Markdown',
                ...keyboards.eveningStartInline()
              }
            );
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Evening ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Evening done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleEveningReminders:', e.message);
      }
    }, { timezone: TZ })
  );

// ─────────────────────────────────────────────────────────────────
// 💰 SUBSCRIPTION CHECK (використовує CRON_SCHEDULES.SUBSCRIPTION_CHECK)
// ─────────────────────────────────────────────────────────────────

export const scheduleSubscriptionCheck = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.SUBSCRIPTION_CHECK, async () => {
      try {
        logger.info('💰 [scheduler] Перевірка підписок…');
        await subscriptionController.sendExpirationReminders(bot);
        logger.info('✅ [scheduler] Перевірка підписок завершена');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleSubscriptionCheck:', e.message);
      }
    }, { timezone: TZ })
  );

// ─────────────────────────────────────────────────────────────────
// 🔄 INACTIVE USERS CHECK (23:00 кожного дня)
// ─────────────────────────────────────────────────────────────────

export const scheduleDailyInactiveCheck = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.DAILY_FINALIZATION, async () => {
      try {
        logger.info('🔄 [scheduler] Перевірка неактивних користувачів…');

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        const today = new Date();

        for (const user of users) {
          const tgId = user.fields.TG_id;
          const lastActive = user.fields.Last_Activity;
          
          if (!lastActive) continue;

          const lastDay = new Date(lastActive);
          const diffDays = Math.floor((today - lastDay) / (1000 * 60 * 60 * 24));

          if (diffDays >= 3) {
            try {
              await bot.telegram.sendMessage(
                tgId,
                '👋 **Ми по тобі скучаємо!**\n\nПовернися до своєї практики! 💪',
                { 
                  parse_mode: 'Markdown',
                  ...keyboards.mainMenuKeyboard()
                }
              );
              await new Promise((r) => setTimeout(r, 500));
            } catch (e) {
              logger.warn(`[scheduler] ⚠️ Inactive ${tgId}: ${e.message}`);
            }
          }
        }

        logger.info('✅ [scheduler] Inactive check done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleDailyInactiveCheck:', e.message);
      }
    }, { timezone: TZ })
  );

// ─────────────────────────────────────────────────────────────────
// 📊 WEEKLY REPORTS (неділя, 19:00 — CRON_SCHEDULES.WEEKLY_REPORTS)
// ─────────────────────────────────────────────────────────────────

export const scheduleWeeklyReports = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.WEEKLY_REPORTS, async () => {
      try {
        logger.info('📊 [scheduler] Щотижневі звіти…');

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          
          try {
            await bot.telegram.sendMessage(
              tgId,
              SCHEDULER_MESSAGES.WEEKLY_PROMPT,
              { 
                parse_mode: 'Markdown',
                ...keyboards.weeklyReportMenuKeyboard()
              }
            );
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Weekly ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Weekly reports done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleWeeklyReports:', e.message);
      }
    }, { timezone: TZ })
  );

// ─────────────────────────────────────────────────────────────────
// 📅 MONTHLY WHEEL CHECK (1 числа, 10:00)
// ─────────────────────────────────────────────────────────────────

export const scheduleMonthlyWheelCheck = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.MONTHLY_WHEEL_CHECK, async () => {
      try {
        logger.info('🎡 [scheduler] Щомісячна перевірка колеса…');

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          
          try {
            await bot.telegram.sendMessage(
              tgId,
              '🎡 **Час для щомісячної перевірки!**\n\nОновимо колесо балансу? 📊',
              { 
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🎡 Почати колесо', callback_data: 'wheel_start' }],
                    [{ text: '⏭️ Пізніше', callback_data: 'main_menu' }]
                  ]
                }
              }
            );
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Monthly wheel ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Monthly wheel check done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleMonthlyWheelCheck:', e.message);
      }
    }, { timezone: TZ })
  );

// ═════════════════════════════════════════════════════════════════
// 🚀 INIT & 🛑 STOP
// ═════════════════════════════════════════════════════════════════

export const initScheduler = (bot) => {
  logger.info(`🚀 [scheduler] Ініціалізація (TZ: ${TZ})…`);

  if (tasks.length) {
    logger.info(`[scheduler] ⚠️ вже активний (${tasks.length} задач), пропускаємо дублювання`);
    return tasks.length;
  }

  logger.info(`[scheduler] 📋 Розклад:`);
  logger.info(`  🌞 Ранок:        ${CRON_SCHEDULES.MORNING_QUESTIONS}`);
  logger.info(`  🌙 Вечір:        ${CRON_SCHEDULES.EVENING_QUESTIONS}`);
  logger.info(`  💰 Підписка:     ${CRON_SCHEDULES.SUBSCRIPTION_CHECK}`);
  logger.info(`  📊 Тижневий:     ${CRON_SCHEDULES.WEEKLY_REPORTS}`);
  logger.info(`  🎡 Місячне коло: ${CRON_SCHEDULES.MONTHLY_WHEEL_CHECK}`);
  logger.info(`  🔄 Неактивні:    ${CRON_SCHEDULES.DAILY_FINALIZATION}`);

  scheduleMorningReminders(bot);
  scheduleEveningReminders(bot);
  scheduleSubscriptionCheck(bot);
  scheduleDailyInactiveCheck(bot);
  scheduleWeeklyReports(bot);
  scheduleMonthlyWheelCheck(bot); // ✅ ДОДАТИ

  logger.info(`✅ [scheduler] Активних задач: ${tasks.length}`);
  return tasks.length;
};

export const stopScheduler = () => {
  for (const t of tasks) {
    try { 
      t.stop(); 
    } catch (e) {
      logger.warn(`[scheduler] ⚠️ Помилка зупинки задачі:`, e.message);
    }
  }
  tasks = [];
  logger.info('🛑 [scheduler] Зупинено всі задачі');
  return true;
};

export default {
  initScheduler,
  stopScheduler,
  scheduleMorningReminders,
  scheduleEveningReminders,
  scheduleSubscriptionCheck,
  scheduleDailyInactiveCheck,
  scheduleWeeklyReports,
  scheduleMonthlyWheelCheck, 
};

console.log('✅ [services/scheduler] Scheduler завантажено (з CRON_SCHEDULES)');