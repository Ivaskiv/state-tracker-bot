// src/utils/scheduler.js
import cron from 'node-cron';
import userService from '../services/userService.js';
import reflectionService from '../services/reflectionService.js';

export function initScheduler(bot) {
  console.log('⏰ Scheduler initialized');

  // Cron тригер кожні 2 хвилини (для тесту)
  cron.schedule('*/2 * * * *', async () => {
    const now = new Date();
    console.log(`\n[CRON TEST] Тригер (кожні 2 хв) о ${now.toLocaleString('uk-UA')}`);

    try {
      await sendDailyQuestions(bot, 'morning');
    } catch (err) {
      console.error('❌ Помилка при запуску ранкових питань:', err);
    }

    try {
      await sendDailyQuestions(bot, 'evening');
    } catch (err) {
      console.error('❌ Помилка при запуску вечірніх питань:', err);
    }
  });
}

async function sendDailyQuestions(bot, type) {
  const now = new Date();
  console.log(`\n[CRON] Запуск ${type} питань о ${now.toLocaleString('uk-UA')}`);

  let users = [];
  try {
    users = await userService.getAllActiveUsers();
    console.log(`🔹 getAllActiveUsers() повернув ${users.length} записів`);
  } catch (err) {
    console.error('❌ Помилка при отриманні користувачів:', err);
    return;
  }

  for (const user of users) {
    try {
      const tgId = user.fields['TG_id'];
      const name = user.fields['User Name'] || 'Невідомий';
      const subStatus = user.fields['Active_Subscription_Status'] || '';
      const lastAnswerDate = user.fields['Last_Answer_Date'] || null;
      let answerStep = user.fields['Answer_Step'] || 'Begin_answer';

      console.log(`\n - Користувач: ${name} | TG_id: ${tgId} | Sub: ${subStatus} | Step: ${answerStep} | LastAnswer: ${lastAnswerDate}`);

      if (!tgId) {
        console.log(`⚠️ Пропускаємо користувача ${name} – відсутній TG_id`);
        continue;
      }

      if (!subStatus.includes('✅ Активна')) {
        console.log(`⚠️ Пропускаємо ${name} – підписка не активна`);
        continue;
      }

      // Якщо користувач ще не почав сьогодні або новий день – скидаємо Step
      const todayStr = new Date().toISOString().split('T')[0];
      if (lastAnswerDate !== todayStr) {
        answerStep = 'Begin_answer';
        console.log(`🔄 Новий день для ${name} – скидаємо Answer_Step на Begin_answer`);
      }

      // Надсилаємо одне питання і чекаємо відповіді
      await reflectionService.startDailyQuestions(bot, tgId, type, answerStep);

      console.log(`✅ Надіслано ${type} питання користувачу: ${name} | TG_id: ${tgId}`);

    } catch (err) {
      console.error('❌ Помилка при обробці користувача:', err);
    }
  }

  console.log(`[CRON] Завершено обробку ${type} питань`);
}
