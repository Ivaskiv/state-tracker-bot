// src/utils/scheduler.js
import cron from 'node-cron';
import userService from '../services/userService.js';
import reflectionService from '../services/reflectionService.js';

export function initScheduler(bot) {
  console.log('⏰ Scheduler initialized');

  // Тестовий cron кожні 2 хвилини
  cron.schedule('*/2 * * * *', async () => {
    const now = new Date();
    console.log(`[CRON TEST] Тригер (кожні 2 хв) о ${now.toLocaleString('uk-UA')}`);
    await sendDailyQuestions(bot, 'morning');
    await sendDailyQuestions(bot, 'evening');
  });
}

async function sendDailyQuestions(bot, type) {
  console.log(`[CRON] Старт обробки ${type} питань о ${new Date().toLocaleString('uk-UA')}`);
  try {
    const users = await userService.getAllActiveUsers();
    console.log(`[CRON] Активних користувачів знайдено: ${users.length}`);
    for (const user of users) {
      const tgId = user.fields['TG_id'];
      try {
        await reflectionService.startDailyQuestions(bot, tgId, type);
      } catch (err) {
        console.error(`❌ Помилка в ${type} питаннях для ${tgId}:`, err);
      }
    }
  } catch (err) {
    console.error('❌ Помилка при отриманні користувачів для scheduler:', err);
  }
}
