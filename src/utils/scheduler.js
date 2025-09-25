// src/utils/scheduler.js - ВИПРАВЛЕНО: БЕЗ REDIS

import cron from 'node-cron';
import userService from '../auth/services/userService.js';
import { CRON_SCHEDULES, SCHEDULE } from '../config/constants.js';

const jobs = [];
let isSchedulerStarted = false;

// Простий захист від дублювання без Redis
const executionLocks = new Set();

const guardExecution = (type) => {
  const now = new Date();
  const key = `${type}_${now.toISOString().slice(0, 16)}`;
  
  if (executionLocks.has(key)) {
    console.log(`[scheduler] ⏭️ Дублювання ${type} пропущено`);
    return false;
  }
  
  executionLocks.add(key);
  // Очищуємо через 2 хвилини
  setTimeout(() => executionLocks.delete(key), 120000);
  return true;
};

// Ранкові нагадування
const sendMorningReminders = async (bot) => {
  if (!guardExecution('morning')) return;
  
  console.log(`[scheduler] 🌞 Ранкові нагадування - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] Знайдено ${users.length} активних користувачів`);
    
    // Обмежуємо до 10 для початку
    for (const user of users.slice(0, 10)) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      if (!tgId) continue;
      
      try {
        await bot.telegram.sendMessage(
          tgId,
          `🌞 Доброго ранку, ${name}!\n\nЧас для ранкової рефлексії! ✨`,
          {
            reply_markup: {
              keyboard: [
                [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
                [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
                [{ text: '💎 Афірмація' }, { text: '📊 Мій прогрес' }],
                [{ text: '💰 Підписка' }, { text: '❓ Допомога' }]
              ],
              resize_keyboard: true,
              persistent: true
            }
          }
        );
        
        console.log(`[scheduler] ✅ Ранкове нагадування надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, userError.message);
      }
      
      // Затримка між користувачами
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка ранкових нагадувань:', error);
  }
};

// Вечірні нагадування
const sendEveningReminders = async (bot) => {
  if (!guardExecution('evening')) return;
  
  console.log(`[scheduler] 🌙 Вечірні нагадування - ${new Date().toLocaleString()}`);
  
  try {
    const users = await userService.getActiveUsers();
    console.log(`[scheduler] Знайдено ${users.length} активних користувачів`);
    
    // Обмежуємо до 10 для початку
    for (const user of users.slice(0, 10)) {
      const tgId = user['TG_id'];
      const name = user['User Name'] || 'Користувач';
      
      if (!tgId) continue;
      
      try {
        await bot.telegram.sendMessage(
          tgId,
          `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день! 🌟`,
          {
            reply_markup: {
              keyboard: [
                [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
                [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
                [{ text: '💎 Афірмація' }, { text: '📊 Мій прогрес' }],
                [{ text: '💰 Підписка' }, { text: '❓ Допомога' }]
              ],
              resize_keyboard: true,
              persistent: true
            }
          }
        );
        
        console.log(`[scheduler] ✅ Вечірнє нагадування надіслано ${tgId}`);
        
      } catch (userError) {
        console.error(`[scheduler] ❌ Помилка для користувача ${tgId}:`, userError.message);
      }
      
      // Затримка між користувачами
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[scheduler] ❌ Помилка вечірніх нагадувань:', error);
  }
};

export const startScheduler = (bot) => {
  if (isSchedulerStarted) {
    console.log('[scheduler] ⏭️ Scheduler вже запущено');
    return;
  }

  console.log('[scheduler] 🚀 Запуск scheduler...');
  console.log(`[scheduler] Timezone: ${SCHEDULE.TIMEZONE}`);
  console.log(`[scheduler] Ранок: ${SCHEDULE.MORNING_TIME}`);
  console.log(`[scheduler] Вечір: ${SCHEDULE.EVENING_TIME}`);

  try {
    // Ранкові нагадування - 08:00
    const morningJob = cron.schedule(CRON_SCHEDULES.MORNING_QUESTIONS, () => {
      sendMorningReminders(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });
    
    // Вечірні нагадування - 21:30
    const eveningJob = cron.schedule(CRON_SCHEDULES.EVENING_QUESTIONS, () => {
      sendEveningReminders(bot);
    }, {
      timezone: SCHEDULE.TIMEZONE,
      scheduled: true
    });

    // Додаємо задачі до списку
    jobs.push(morningJob, eveningJob);
    isSchedulerStarted = true;

    console.log('✅ [scheduler] Scheduler запущено успішно');
    console.log(`📅 [scheduler] Ранкові: ${CRON_SCHEDULES.MORNING_QUESTIONS}`);
    console.log(`📅 [scheduler] Вечірні: ${CRON_SCHEDULES.EVENING_QUESTIONS}`);
    
  } catch (error) {
    console.error('[scheduler] ❌ Помилка запуску scheduler:', error);
  }
};

export const stopScheduler = () => {
  console.log('[scheduler] 🛑 Зупинка scheduler...');
  
  jobs.forEach((job, index) => {
    try {
      job.destroy();
      console.log(`[scheduler] ✅ Зупинено задачу ${index + 1}`);
    } catch (error) {
      console.error(`[scheduler] ❌ Помилка зупинки задачі ${index + 1}:`, error);
    }
  });
  
  jobs.length = 0;
  isSchedulerStarted = false;
  executionLocks.clear();
  
  console.log('[scheduler] ✅ Scheduler зупинено');
};