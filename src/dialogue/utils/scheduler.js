// src/dialogue/utils/scheduler.js
import cron from 'node-cron';
import userService from '../../auth/services/userService.js';
import reminderService from '../services/reminderService.js';
import responseService from '../services/responseService.js';
import analyticsController from '../../controllers/analyticsController.js';
import { 
  SCHEDULE, 
  REPORT_SCHEDULE, 
  ANSWER_STEPS, 
  CRON_EXPRESSIONS,
  SCHEDULER_MESSAGES,
  ACTIVITY_THRESHOLDS,
  QUESTION_TYPES
} from '../../config/constants.js';

// ⚠️ Ініціалізація планувальника
export const initScheduler = (bot) => {
  console.log('[scheduler] ⏰ Планувальник ініціалізовано');

  // ⚠️ Надсилання повідомлень активним користувачам - винесено логіку
  const sendToActiveUsers = async (callback, logPrefix) => {
    try {
      const users = await userService.getAllUsers();
      const activeUsers = users.filter(u => u['Active_Subscription_Status']?.includes('✅ Активна'));
      console.log(`[scheduler] ${logPrefix} - Знайдено ${activeUsers.length} активних користувачів`);
      
      for (const user of activeUsers) {
        try {
          await callback(user);
          await new Promise(resolve => setTimeout(resolve, ACTIVITY_THRESHOLDS.USER_DELAY_MS));
        } catch (err) {
          console.error(`[scheduler] ${logPrefix} - Помилка для користувача ${user.TG_id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[scheduler] ${logPrefix} - Помилка отримання користувачів:`, err);
    }
  };

  // ⚠️ Ранкові питання - використовуємо SCHEDULE.MORNING_TIME
  const [morningHour, morningMinute] = SCHEDULE.MORNING_TIME.split(':').map(Number);
  cron.schedule(`${morningMinute} ${morningHour} * * *`, () => {
    const logPrefix = '🌞 Надсилання ранкових питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.COMPLETED);
      await reminderService.startMorningSession(bot, user);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Вечірні питання - використовуємо SCHEDULE.EVENING_TIME
  const [eveningHour, eveningMinute] = SCHEDULE.EVENING_TIME.split(':').map(Number);
  cron.schedule(`${eveningMinute} ${eveningHour} * * *`, () => {
    const logPrefix = '🌙 Надсилання вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      await reminderService.startEveningSession(bot, user);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Щотижневий звіт - використовуємо REPORT_SCHEDULE
  const { dayOfWeek, hour: weeklyHour, minute: weeklyMinute } = REPORT_SCHEDULE.WEEKLY;
  cron.schedule(`${weeklyMinute} ${weeklyHour} * * ${dayOfWeek}`, () => {
    const logPrefix = '📊 Надсилання щотижневих звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const report = await analyticsController.generateWeeklyReportForUser(user.TG_id);
        if (report) {
          await bot.telegram.sendMessage(user.TG_id, SCHEDULER_MESSAGES.WEEKLY_REPORT_READY);
          await new Promise(resolve => setTimeout(resolve, ACTIVITY_THRESHOLDS.TYPING_DELAY_MS));
          await bot.telegram.sendMessage(user.TG_id, report);
          console.log(`[scheduler] ✅ Надіслано щотижневий звіт користувачу ${user.TG_id}`);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка генерації щотижневого звіту для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Місячний звіт - використовуємо REPORT_SCHEDULE
  const { dayRange, hour: monthlyHour, minute: monthlyMinute } = REPORT_SCHEDULE.MONTHLY;
  cron.schedule(`${monthlyMinute} ${monthlyHour} ${dayRange.join(',')} * *`, () => {
    const logPrefix = '📈 Надсилання місячних звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const report = await analyticsController.generateMonthlyReportForUser(user.TG_id);
        if (report) {
          await bot.telegram.sendMessage(user.TG_id, SCHEDULER_MESSAGES.MONTHLY_REPORT_READY);
          await new Promise(resolve => setTimeout(resolve, ACTIVITY_THRESHOLDS.TYPING_DELAY_MS));
          await bot.telegram.sendMessage(user.TG_id, report);
          console.log(`[scheduler] ✅ Надіслано місячний звіт користувачу ${user.TG_id}`);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка генерації місячного звіту для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Нагадування ранкових - використовуємо CRON_EXPRESSIONS
  cron.schedule(CRON_EXPRESSIONS.MORNING_REMINDER, () => {
    const logPrefix = '🔔 Нагадування ранкових питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const isCompleted = await responseService.isSessionCompleted(user.TG_id, QUESTION_TYPES.MORNING);
        const isInProgress = user.Answer_Step && user.Answer_Step.startsWith('Q_m_');
        
        if (!isCompleted && !isInProgress) {
          await reminderService.sendReminder(bot, user.TG_id, QUESTION_TYPES.MORNING);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Нагадування вечірніх - використовуємо CRON_EXPRESSIONS
  cron.schedule(CRON_EXPRESSIONS.EVENING_REMINDER, () => {
    const logPrefix = '🔔 Нагадування вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const isCompleted = await responseService.isSessionCompleted(user.TG_id, QUESTION_TYPES.EVENING);
        const isInProgress = user.Answer_Step && user.Answer_Step.startsWith('Q_e_');
        
        if (!isCompleted && !isInProgress) {
          await reminderService.sendReminder(bot, user.TG_id, QUESTION_TYPES.EVENING);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Нагадування про звіти - використовуємо CRON_EXPRESSIONS та константи
  cron.schedule(CRON_EXPRESSIONS.REPORTS_REMINDER, () => {
    const logPrefix = '💡 Нагадування про звіти';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const recentRecords = await responseService.getUserRecords(user.TG_id, ACTIVITY_THRESHOLDS.RECENT_ACTIVITY_DAYS);
        if (recentRecords.length >= ACTIVITY_THRESHOLDS.MIN_RESPONSES_FOR_REMINDER) {
          await bot.telegram.sendMessage(user.TG_id, SCHEDULER_MESSAGES.REPORTS_REMINDER);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування про звіти для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ⚠️ Логи ініціалізації - використовуємо константи
  console.log(`[scheduler] ✅ Ранкові питання заплановано на ${SCHEDULE.MORNING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Вечірні питання заплановано на ${SCHEDULE.EVENING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Щотижневі звіти заплановано на неділю ${REPORT_SCHEDULE.WEEKLY.hour}:${REPORT_SCHEDULE.WEEKLY.minute.toString().padStart(2, '0')} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Місячні звіти заплановано на кінець місяця ${REPORT_SCHEDULE.MONTHLY.hour}:${REPORT_SCHEDULE.MONTHLY.minute.toString().padStart(2, '0')} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Нагадування ранкових питань: ${CRON_EXPRESSIONS.MORNING_REMINDER}`);
  console.log(`[scheduler] ✅ Нагадування вечірніх питань: ${CRON_EXPRESSIONS.EVENING_REMINDER}`);
  console.log(`[scheduler] ✅ Нагадування про звіти: ${CRON_EXPRESSIONS.REPORTS_REMINDER}`);
};