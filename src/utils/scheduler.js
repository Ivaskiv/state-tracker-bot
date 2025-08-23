import cron from 'node-cron';
import { getBase, tables } from '../config/database.js';
import { QUESTION_TYPES, SCHEDULE } from '../config/constants.js';
import { sendNextQuestion } from '../services/reminderService.js';

export const initScheduler = (bot) => {
  console.log('⏰ Scheduler initialized');

  // Ранкові о 21:00
  cron.schedule(`15 21 * * *`, async () => {
    console.log('[CRON] Ранкові питання', new Date().toISOString());
    const base = getBase();
    const users = await base(tables.USERS).select().all();
    console.log('[CRON] Користувачів знайдено:', users.length);
    for (const u of users) {
      console.log('[CRON] Надсилаємо ранкове питання користувачу:', u.fields.TG_id);
      await sendNextQuestion(bot, u.fields.TG_id);
    }
  }, { timezone: SCHEDULE.TIMEZONE });

  // Вечірні о 20:30
  cron.schedule(`0 23 * * *`, async () => {
    console.log('[CRON] Вечірні питання', new Date().toISOString());
    const base = getBase();
    const users = await base(tables.USERS).select().all();
    console.log('[CRON] Користувачів знайдено:', users.length);
    for (const u of users) {
      console.log('[CRON] Надсилаємо вечірнє питання користувачу:', u.fields.TG_id);
      await sendNextQuestion(bot, u.fields.TG_id);
    }
  }, { timezone: SCHEDULE.TIMEZONE });
};
