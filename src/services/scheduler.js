// src/services/scheduler.js

import cron from 'node-cron';
import logger from '../utils/logger.js';
import keyboards from '../utils/keyboards.js';
import { getBase, tables } from '../config/database.js';
import subscriptionController from '../features/subscription/controller.js';

const base = getBase();

// Тримаємо посилання на всі задачі, щоб зупиняти
let tasks = [];

const pushTask = (task) => {
  tasks.push(task);
  return task;
};

// 🌞 Morning (08:00)
export const scheduleMorningReminders = (bot) =>
  pushTask(
    cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('🌞 [scheduler] Ранкові нагадування…');

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          try {
            await bot.telegram.sendMessage(
              tgId,
              '🌞 **Добрий ранок!**\n\nГотовий почати ранкову рефлексію?',
              { parse_mode: 'Markdown', ...keyboards.morningStartInline() }
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
    })
  );

// 🌙 Evening (19:00)
export const scheduleEveningReminders = (bot) =>
  pushTask(
    cron.schedule('0 19 * * *', async () => {
      try {
        logger.info('🌙 [scheduler] Вечірні нагадування…');

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          try {
            await bot.telegram.sendMessage(
              tgId,
              '🌙 **Вечір!**\n\nГотовий підвести підсумки дня?',
              { parse_mode: 'Markdown', ...keyboards.eveningStartInline() }
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
    })
  );

// 💰 Subscription check (10:00)
export const scheduleSubscriptionCheck = (bot) =>
  pushTask(
    cron.schedule('0 10 * * *', async () => {
      try {
        logger.info('💰 [scheduler] Перевірка підписок…');
        await subscriptionController.sendExpirationReminders(bot);
        logger.info('✅ [scheduler] Перевірка підписок завершена');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleSubscriptionCheck:', e.message);
      }
    })
  );

// 🔄 Inactive users (23:00)
export const scheduleDailyInactiveCheck = (bot) =>
  pushTask(
    cron.schedule('0 23 * * *', async () => {
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
                '👋 **Ми по тобі скучаємо!**\n\nПовернися до своєї практики!',
                { parse_mode: 'Markdown', ...keyboards.mainMenuKeyboard() }
              );
              await new Promise((r) => setTimeout(r, 500));
            } catch (e) {
              logger.warn(`[scheduler] ⚠️ Inactive ${tgId}: ${e.message}`);
            }
          }
        }

        logger.info('✅ [scheduler] Inactive done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleDailyInactiveCheck:', e.message);
      }
    })
  );

// 📊 Weekly reports (Mon 10:00)
export const scheduleWeeklyReports = (bot) =>
  pushTask(
    cron.schedule('0 10 * * 1', async () => {
      try {
        logger.info('📊 [scheduler] Відправлення тижневих звітів…');

        const users = await base(tables.USERS).select({ maxRecords: 500 }).all();
        for (const user of users) {
          const tgId = user.fields.TG_id;
          try {
            await bot.telegram.sendMessage(
              tgId,
              '📊 **Твій тижневий звіт готовий!**\n\nПереглянути деталі?',
              { parse_mode: 'Markdown', ...keyboards.weeklyReportMenuKeyboard() }
            );
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            logger.warn(`[scheduler] ⚠️ Weekly ${tgId}: ${e.message}`);
          }
        }

        logger.info('✅ [scheduler] Weekly done');
      } catch (e) {
        logger.error('❌ [scheduler] scheduleWeeklyReports:', e.message);
      }
    })
  );

// 🚀 Init + 🛑 Stop
export const initScheduler = (bot) => {
  logger.info('🚀 [scheduler] Ініціалізація…');

  // якщо вже запущено — не дублюємо
  if (tasks.length) {
    logger.info(`[scheduler] вже активний (${tasks.length} задач)`);
    return tasks.length;
  }

  scheduleMorningReminders(bot);
  scheduleEveningReminders(bot);
  scheduleSubscriptionCheck(bot);
  scheduleDailyInactiveCheck(bot);
  scheduleWeeklyReports(bot);

  logger.info(`✅ [scheduler] Активних задач: ${tasks.length}`);
  return tasks.length;
};

export const stopScheduler = () => {
  for (const t of tasks) {
    try { t.stop(); } catch {}
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
};
