// src/services/schedulerService.js
import cron from 'node-cron';
import userService from './userService.js';
import reminderService from './reminderService.js';
import { SCHEDULE } from '../config/constants.js';

const setupScheduler = (bot) => {
  console.log("[scheduler] ⏰ Scheduler initialized");

  const sendToActiveUsers = async (callback) => {
    try {
      const users = await userService.getAllUsers();
      const activeUsers = users.filter(u => u['Active_Subscription_Status']?.includes('✅ Активна'));
      
      console.log(`[scheduler] Found ${activeUsers.length} active users`);
      
      for (const user of activeUsers) {
        try {
          await callback(user);
        } catch (err) {
          console.error(`[scheduler] Error processing user ${user.TG_id}:`, err);
        }
      }
    } catch (err) {
      console.error('[scheduler] Error getting active users:', err);
    }
  };

  // Ранковий планувальник
  const [morningHour, morningMinute] = SCHEDULE.MORNING_TIME.split(':').map(Number);
  cron.schedule(`${morningMinute} ${morningHour} * * *`, () => {
    console.log(`[scheduler] 🚀 Sending morning questions at ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(user => reminderService.startMorningSession(bot, user));
  }, { 
    timezone: SCHEDULE.TIMEZONE,
    scheduled: true 
  });

  // Вечірній планувальник
  const [eveningHour, eveningMinute] = SCHEDULE.EVENING_TIME.split(':').map(Number);
  cron.schedule(`${eveningMinute} ${eveningHour} * * *`, () => {
    console.log(`[scheduler] 🌙 Sending evening questions at ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    sendToActiveUsers(user => reminderService.startEveningSession(bot, user));
  }, { 
    timezone: SCHEDULE.TIMEZONE,
    scheduled: true 
  });

  console.log(`[scheduler] Morning questions scheduled for ${SCHEDULE.MORNING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] Evening questions scheduled for ${SCHEDULE.EVENING_TIME} (${SCHEDULE.TIMEZONE})`);
};

export default { setupScheduler };