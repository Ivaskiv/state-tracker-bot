// src/utils/scheduler.js
import cron from 'node-cron';
import { getBase, tables } from '../config/database.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS, QUESTION_TYPES, SCHEDULE } from '../config/constants.js';
import { sendReminder } from '../services/reminderService.js';

const base = getBase();

export const initScheduler = bot => {
  console.log('⏰ Scheduler initialized');

cron.schedule('* * * * *', async () => {
  console.log('[CRON] TEST');
}, { timezone: SCHEDULE.TIMEZONE });

  // Ранкові
  cron.schedule(
    '35 20 * * *',
    async () => {
      console.log('[CRON] Запуск ранкових питань');
      const users = await base(tables.USERS).select().all();
      for (let u of users) {
        await sendReminder(bot, u.fields.TG_id, MORNING_QUESTIONS, QUESTION_TYPES.MORNING);
      }
    },
    { timezone: SCHEDULE.TIMEZONE }
  );

  // Вечірні
  cron.schedule(
    '30 21 * * *',
    async () => {
      console.log('[CRON] Запуск вечірніх питань');
      const users = await base(tables.USERS).select().all();
      for (let u of users) {
        await sendReminder(bot, u.fields.TG_id, EVENING_QUESTIONS, QUESTION_TYPES.EVENING);
      }
    },
    { timezone: SCHEDULE.TIMEZONE }
  );
};
