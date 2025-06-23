import cron from 'node-cron';
import User from '../models/user.js';
import config from '../config/config.js';

const scheduleTasks = {};

const frequencies = {
  hourly: () => ['0 * * * *'],
  '2hours': () => Array.from({ length: 12 }, (_, i) => `0 ${i * 2} * * *`),
  morning_evening: () => ['0 9 * * *', '0 19 * * *']
};

export async function initScheduler(bot) {
  try {
    const users = await User.find();
    await Promise.all(users.map(user => setupUserSchedule(bot, user)));
    console.log(`🗓️ Scheduled tasks for ${users.length} users`);
  } catch (err) {
    console.error('❌ Error initializing scheduler:', err);
  }
}

export async function updateUserSchedule(bot, userId) {
  try {
    const user = await User.findOne({ telegramId: userId });
    if (user) await setupUserSchedule(bot, user);
  } catch (err) {
    console.error(`❌ Error updating schedule for user ${userId}:`, err);
  }
}

export async function setupUserSchedule(bot, user) {
  const { telegramId, frequency, startTime, endTime } = user;

  if (scheduleTasks[telegramId]) {
    scheduleTasks[telegramId].forEach(task => task.stop());
  }
  scheduleTasks[telegramId] = [];

  const cronExpressions = frequencies[frequency]?.();
  if (!cronExpressions) {
    console.warn(`⚠️ Unknown frequency: ${frequency}`);
    return;
  }

  console.log(`🔁 Setting up schedule for ${telegramId} [${frequency}]`);

  cronExpressions.forEach(expr => {
    const task = cron.schedule(expr, async () => {
      const nowHour = new Date().getHours();
      if (nowHour >= startTime && nowHour <= endTime) {
        await sendPollNotification(bot, user);
      }
    });
    scheduleTasks[telegramId].push(task);
  });
}

async function sendPollNotification(bot, user) {
  try {
    const { pollSettings } = config.themes[user.theme] || config.themes.emotionTracking;
    const keyboard = ['states', 'emotions', 'feelings', 'actions']
      .flatMap(key =>
        pollSettings[key].map(item => ({
          text: item.text,
          callback_data: `${key.slice(0, -1)}_${item.key}`
        }))
      );

    console.log(`[${new Date().toISOString()}] 📩 Sending poll to ${user.telegramId}`);
    await bot.telegram.sendMessage(
      user.telegramId,
      `Привіт, ${user.name || 'користувачу'}! 🧘 Настав час перевірити твій емоційний стан.`,
      {
        reply_markup: {
          inline_keyboard: chunkArray(keyboard, 2) // показуємо по 2 кнопки в ряд
        }
      }
    );
  } catch (err) {
    console.error(`❌ Error sending poll to ${user.telegramId}:`, err);
  }
}

// Допоміжна функція: розбиває масив на частини
function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}
