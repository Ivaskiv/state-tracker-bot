import cron from 'node-cron';
import { getActiveUsers } from '../utils/airtable.js';
import { config } from '../config/config.js';
import { createKeyboard } from './helpers.js';

const scheduledTasks = [];

export async function initScheduler(bot) {
  try {
    cron.schedule(config.schedules.morning, async () => {
      await sendMorningReminders(bot);
    });

    cron.schedule(config.schedules.evening, async () => {
      await sendEveningReminders(bot);
    });

    cron.schedule('0 19 * * 0', async () => {
      await generateWeeklyReports(bot);
    });

    cron.schedule('0 12 1 * *', async () => {
      await generateMonthlyReports(bot);
    });

    console.log('🗓️ Scheduler initialized');
  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
}

async function sendMorningReminders(bot) {
  try {
    const users = await getActiveUsers();
    
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.fields.tg_user_id,
          `${config.messages.morningIntro}\n\n🌱 Готова почати день з фокусу?`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🌞 Почати ранкову сесію', callback_data: 'start_morning' }
              ]]
            }
          }
        );
      } catch (error) {
        console.error(`Error sending morning reminder to ${user.fields.tg_user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendMorningReminders:', error);
  }
}

async function sendEveningReminders(bot) {
  try {
    const users = await getActiveUsers();
    
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.fields.tg_user_id,
          `${config.messages.eveningIntro}\n\n🌙 Час підсумувати день!`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🌙 Почати вечірню сесію', callback_data: 'start_evening' }
              ]]
            }
          }
        );
      } catch (error) {
        console.error(`Error sending evening reminder to ${user.fields.tg_user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendEveningReminders:', error);
  }
}

async function generateWeeklyReports(bot) {
  try {
    const users = await getActiveUsers();
    
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.fields.tg_user_id,
          `${config.messages.weeklyReportIntro}\n\n📈 Твій звіт формується... Невдовзі отримаєш детальний аналіз!`
        );
      } catch (error) {
        console.error(`Error sending weekly report to ${user.fields.tg_user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in generateWeeklyReports:', error);
  }
}

async function generateMonthlyReports(bot) {
  try {
    const users = await getActiveUsers();
    
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.fields.tg_user_id,
          `${config.messages.monthlyReportIntro}\n\n📊 Формую глибокий аналіз твоїх змін за місяць...`
        );
      } catch (error) {
        console.error(`Error sending monthly report to ${user.fields.tg_user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in generateMonthlyReports:', error);
  }
}