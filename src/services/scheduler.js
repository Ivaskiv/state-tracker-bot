// src/services/scheduler.js
import cron from 'node-cron';
import logger from '../utils/logger.js';
import keyboards from '../utils/keyboards.js';
import { getBase, tables } from '../config/database.js';
import { CRON_SCHEDULES, SCHEDULE } from '../config/constants.js';

const base = getBase();
const TZ = SCHEDULE.TIMEZONE;

let tasks = [];

const pushTask = (task) => {
  tasks.push(task);
  return task;
};

// ═══════════════════════════════════════════════════════════
// 🌞 MORNING REMINDERS
// ═══════════════════════════════════════════════════════════

export const scheduleMorningReminders = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, async () => {
      try {
        logger.info(`🌞 [scheduler] Ранкові нагадування (${SCHEDULE.MORNING_TIME})`);

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        
        for (const user of users) {
          const tgId = user.fields.TG_id;
          if (!tgId) continue;

          const userName = user.fields['User Name'] || 'Користувач';

          try {
            await bot.telegram.sendMessage(
              tgId,
              `🌞 Доброго ранку, ${userName}!\n\nЧас для ранкової рефлексії! ✨`,
              { ...keyboards.morningStartInline() }
            );
            await new Promise(r => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Morning ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Morning done');
      } catch (e) {
        logger.error('❌ [scheduler] Morning error:', e);
      }
    }, { timezone: TZ })
  );

// ═══════════════════════════════════════════════════════════
// 🌙 EVENING REMINDERS
// ═══════════════════════════════════════════════════════════

export const scheduleEveningReminders = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, async () => {
      try {
        logger.info(`🌙 [scheduler] Вечірні нагадування (${SCHEDULE.EVENING_TIME})`);

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();

        for (const user of users) {
          const tgId = user.fields.TG_id;
          if (!tgId) continue;

          const userName = user.fields['User Name'] || 'Користувач';

          try {
            await bot.telegram.sendMessage(
              tgId,
              `🌙 Добрий вечір, ${userName}!\n\nЧас підсумувати день! 🏆`,
              { ...keyboards.eveningStartInline() }
            );
            await new Promise(r => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Evening ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Evening done');
      } catch (e) {
        logger.error('❌ [scheduler] Evening error:', e);
      }
    }, { timezone: TZ })
  );

// ═══════════════════════════════════════════════════════════
// 💰 SUBSCRIPTION CHECK
// ═══════════════════════════════════════════════════════════

export const scheduleSubscriptionCheck = (bot) =>
  pushTask(
    cron.schedule(CRON_SCHEDULES.SUBSCRIPTION_CHECK, async () => {
      try {
        logger.info('💰 [scheduler] Перевірка підписок');
        
        const { sendExpirationReminders } = await import('../core/subscription/controller.js');
        await sendExpirationReminders(bot);
        
        logger.info('✅ [scheduler] Subscription check done');
      } catch (e) {
        logger.error('❌ [scheduler] Subscription error:', e);
      }
    }, { timezone: TZ })
  );

// ═══════════════════════════════════════════════════════════
// 🚀 INIT & 🛑 STOP
// ═══════════════════════════════════════════════════════════

export const initScheduler = (bot) => {
  logger.info(`🚀 [scheduler] Ініціалізація (TZ: ${TZ})`);

  if (tasks.length) {
    logger.info(`[scheduler] ⚠️ Вже активний (${tasks.length} задач)`);
    return tasks.length;
  }

  scheduleMorningReminders(bot);
  scheduleEveningReminders(bot);
  scheduleSubscriptionCheck(bot);

  logger.info(`✅ [scheduler] Активних задач: ${tasks.length}`);
  return tasks.length;
};

export const stopScheduler = () => {
  tasks.forEach(t => t.stop());
  tasks = [];
  logger.info('🛑 [scheduler] Зупинено');
};

export default { initScheduler, stopScheduler };