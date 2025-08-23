// src/utils/scheduler.js
import cron from 'node-cron';
import { getBase, tables } from '../config/database.js';
import { SCHEDULE } from '../config/constants.js';
import sendNextQuestion from '../services/reminderService.js';

export const initScheduler = (bot) => {
  console.log('[scheduler] ⏰ Scheduler initialized');

  const base = getBase();

  // Ранкові
  cron.schedule(`0 ${SCHEDULE.MORNING_HOUR} * * *`, async () => {
    console.log('[scheduler] 🚀 Morning cron triggered');
    try {
      const users = await base(tables.USERS).select().all();
      console.log('[scheduler] Users count:', users.length);

      for (const u of users) {
        console.log('[scheduler] Morning → sending to user:', u.fields.TG_id);
        await sendNextQuestion(bot, u.fields.TG_id);
      }
    } catch (err) {
      console.error('[scheduler] Morning CRON ERROR:', err);
    }
  }, { timezone: SCHEDULE.TIMEZONE });

  // Вечірні
  cron.schedule(`0 ${SCHEDULE.EVENING_HOUR} * * *`, async () => {
    console.log('[scheduler] 🚀 Evening cron triggered');
    try {
      const users = await base(tables.USERS).select().all();
      console.log('[scheduler] Users count:', users.length);

      for (const u of users) {
        console.log('[scheduler] Evening → sending to user:', u.fields.TG_id);
        await sendNextQuestion(bot, u.fields.TG_id);
      }
    } catch (err) {
      console.error('[scheduler] Evening CRON ERROR:', err);
    }
  }, { timezone: SCHEDULE.TIMEZONE });
};
