// src/utils/scheduler.js
// src/utils/scheduler.js
import cron from 'node-cron';
import userService from '../../auth/services/userService.js';
import reminderService from '../services/reminderService.js';
import responseService from '../services/responseService.js';
import analyticsController from '../../controllers/analyticsController.js';
import { SCHEDULE, REPORT_SCHEDULE, ANSWER_STEPS } from '../../config/constants.js';

// Ініціалізація планувальника
export const initScheduler = (bot) => {
  console.log('[scheduler] ⏰ Планувальник ініціалізовано');

  // Надсилання повідомлень активним користувачам
  const sendToActiveUsers = async (callback, logPrefix) => {
    try {
      const users = await userService.getAllUsers();
      const activeUsers = users.filter(u => u['Active_Subscription_Status']?.includes('✅ Активна'));
      console.log(`[scheduler] ${logPrefix} - Знайдено ${activeUsers.length} активних користувачів`);
      
      for (const user of activeUsers) {
        try {
          await callback(user);
          // Додаємо невелику затримку між користувачами
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`[scheduler] ${logPrefix} - Помилка для користувача ${user.TG_id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[scheduler] ${logPrefix} - Помилка отримання користувачів:`, err);
    }
  };

  // ✅ Ранкові питання (з MORNING_TIME)
  const [morningHour, morningMinute] = SCHEDULE.MORNING_TIME.split(':').map(Number);
  cron.schedule(`${morningMinute} ${morningHour} * * *`, () => {
    const logPrefix = '🌞 Надсилання ранкових питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      // Скидаємо статус користувача для нового дня
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.COMPLETED);
      // Запускаємо ранкову сесію
      await reminderService.startMorningSession(bot, user);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ✅ Вечірні питання (з EVENING_TIME)
  const [eveningHour, eveningMinute] = SCHEDULE.EVENING_TIME.split(':').map(Number);
  cron.schedule(`${eveningMinute} ${eveningHour} * * *`, () => {
    const logPrefix = '🌙 Надсилання вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      await reminderService.startEveningSession(bot, user);
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ✅ Щотижневий звіт (неділя, 19:00)
  const { dayOfWeek, hour: weeklyHour, minute: weeklyMinute } = REPORT_SCHEDULE.WEEKLY;
  cron.schedule(`${weeklyMinute} ${weeklyHour} * * ${dayOfWeek}`, () => {
    const logPrefix = '📊 Надсилання щотижневих звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const report = await analyticsController.generateWeeklyReportForUser(user.TG_id);
        if (report) {
          await bot.telegram.sendMessage(user.TG_id, `📊 Щотижневий AI-звіт готовий!`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await bot.telegram.sendMessage(user.TG_id, report);
          console.log(`[scheduler] ✅ Надіслано щотижневий звіт користувачу ${user.TG_id}`);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка генерації щотижневого звіту для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ✅ Місячний звіт (останній день місяця, 22:00)
  const { dayRange, hour: monthlyHour, minute: monthlyMinute } = REPORT_SCHEDULE.MONTHLY;
  cron.schedule(`${monthlyMinute} ${monthlyHour} ${dayRange.join(',')} * *`, () => {
    const logPrefix = '📈 Надсилання місячних звітів';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const report = await analyticsController.generateMonthlyReportForUser(user.TG_id);
        if (report) {
          await bot.telegram.sendMessage(user.TG_id, `📈 Місячний AI-звіт готовий!`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await bot.telegram.sendMessage(user.TG_id, report);
          console.log(`[scheduler] ✅ Надіслано місячний звіт користувачу ${user.TG_id}`);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка генерації місячного звіту для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ✅ Нагадування о 12:00 для тих, хто не відповів на ранкові питання
  cron.schedule('0 12 * * *', () => {
    const logPrefix = '🔔 Нагадування ранкових питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const isCompleted = await responseService.isSessionCompleted(user.TG_id, 'Morning');
        if (!isCompleted && user.Answer_Step !== ANSWER_STEPS.COMPLETED) {
          await reminderService.sendReminder(bot, user.TG_id, 'Morning');
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ✅ Нагадування о 21:00 для тих, хто не відповів на вечірні питання
  cron.schedule('0 21 * * *', () => {
    const logPrefix = '🔔 Нагадування вечірніх питань';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        const isCompleted = await responseService.isSessionCompleted(user.TG_id, 'Evening');
        if (!isCompleted) {
          await reminderService.sendReminder(bot, user.TG_id, 'Evening');
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // ✅ Щоденне нагадування про можливість отримати звіти (18:00)
  cron.schedule('0 18 * * *', () => {
    const logPrefix = '💡 Нагадування про звіти';
    console.log(`[scheduler] ${logPrefix} о ${new Date().toLocaleString('uk-UA', { timeZone: SCHEDULE.TIMEZONE })}`);
    
    sendToActiveUsers(async (user) => {
      try {
        // Надсилаємо тільки якщо користувач активно відповідає на питання
        const recentRecords = await responseService.getUserRecords(user.TG_id, 3);
        if (recentRecords.length >= 2) {
          const reminderText = `💡 Не забувай переглядати свої звіти!\n\n📊 "Щотижневий звіт" - аналіз шаблонів\n📈 "Щомісячний звіт" - глибокий інсайт\n\nЗвіти допомагають усвідомити прогрес та знайти точки росту! 🌱`;
          await bot.telegram.sendMessage(user.TG_id, reminderText);
        }
      } catch (error) {
        console.error(`[scheduler] ❌ Помилка нагадування про звіти для ${user.TG_id}:`, error);
      }
    }, logPrefix);
  }, { timezone: SCHEDULE.TIMEZONE });

  // Логи ініціалізації
  console.log(`[scheduler] ✅ Ранкові питання заплановано на ${SCHEDULE.MORNING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Вечірні питання заплановано на ${SCHEDULE.EVENING_TIME} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Щотижневі звіти заплановано на неділю ${REPORT_SCHEDULE.WEEKLY.hour}:${REPORT_SCHEDULE.WEEKLY.minute.toString().padStart(2, '0')} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Місячні звіти заплановано на кінець місяця ${REPORT_SCHEDULE.MONTHLY.hour}:${REPORT_SCHEDULE.MONTHLY.minute.toString().padStart(2, '0')} (${SCHEDULE.TIMEZONE})`);
  console.log(`[scheduler] ✅ Нагадування ранкових питань: 12:00`);
  console.log(`[scheduler] ✅ Нагадування вечірніх питань: 21:00`);
  console.log(`[scheduler] ✅ Нагадування про звіти: 18:00`);
};