// Файл utils/scheduler.js
import cron from 'node-cron';
import User from '../models/user.js';
import { startPoll } from '../controllers/polling.js';

// Словник для зберігання завдань cron
const scheduleTasks = {};

// Ініціалізація планувальника для всіх користувачів
async function initScheduler(bot) {
  try {
    // Отримуємо всіх користувачів
    const users = await User.find();
    
    // Налаштовуємо розклад для кожного користувача
    await Promise.all(users.map(user => setupUserSchedule(bot, user)));
    
    console.log(`Scheduled tasks for ${users.length} users`);
  } catch (err) {
    console.error('Error initializing scheduler:', err);
  }
}

// Налаштування розкладу для конкретного користувача
async function setupUserSchedule(bot, user) {
  // Очищаємо попередні завдання для користувача
  if (scheduleTasks[user.telegramId]) {
    scheduleTasks[user.telegramId].forEach(task => task.stop());
    delete scheduleTasks[user.telegramId];
  }
  
  // Створюємо масив для завдань
  scheduleTasks[user.telegramId] = [];
  
  // Налаштування розкладу залежно від частоти
  switch (user.frequency) {
    case 'hourly':
      setupHourlySchedule(bot, user);
      break;
    case '2hours':
      setup2HoursSchedule(bot, user);
      break;
    case 'morning_evening':
      setupMorningEveningSchedule(bot, user);
      break;
    default:
      console.error(`Unknown frequency: ${user.frequency}`);
  }
}

// Налаштування щогодинного розкладу
function setupHourlySchedule(bot, user) {
  const { startTime, endTime } = user;
  
  const task = cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    
    // Перевіряємо, чи зараз робочий час
    if (hour >= startTime && hour <= endTime) {
      await sendPollNotification(bot, user);
    }
  });
  
  // Зберігаємо завдання
  scheduleTasks[user.telegramId].push(task);
}

// Налаштування розкладу кожні 2 години
function setup2HoursSchedule(bot, user) {
  const { startTime, endTime } = user;
  
  const task = cron.schedule('0 0,2,4,6,8,10,12,14,16,18,20,22 * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    
    // Перевіряємо, чи зараз робочий час
    if (hour >= startTime && hour <= endTime) {
      await sendPollNotification(bot, user);
    }
  });
  
  // Зберігаємо завдання
  scheduleTasks[user.telegramId].push(task);
}

// Налаштування розкладу зранку та ввечері
function setupMorningEveningSchedule(bot, user) {
  const { startTime, endTime } = user;

  // Зранку
  if (9 >= startTime && 9 <= endTime) {
    const morningTask = cron.schedule('0 9 * * *', async () => {
      await sendPollNotification(bot, user);
    });
    scheduleTasks[user.telegramId].push(morningTask);
  }
  
  // Ввечері
  if (19 >= startTime && 19 <= endTime) {
    const eveningTask = cron.schedule('0 19 * * *', async () => {
      await sendPollNotification(bot, user);
    });
    scheduleTasks[user.telegramId].push(eveningTask);
  }
}

// Відправка повідомлення для опитування
async function sendPollNotification(bot, user) {
  try {
    await bot.telegram.sendMessage(
      user.telegramId,
      `Привіт, ${user.name}! Настав час перевірити твій емоційний стан.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Пройти опитування', callback_data: 'start_poll' }]
          ]
        }
      }
    );
  } catch (err) {
    console.error(`Error sending poll notification to user ${user.telegramId}:`, err);
  }
}

// Оновлення розкладу користувача
async function updateUserSchedule(bot, userId) {
  try {
    const user = await User.findOne({ telegramId: userId });
    
    if (user) {
      await setupUserSchedule(bot, user);
    }
  } catch (err) {
    console.error(`Error updating schedule for user ${userId}:`, err);
  }
}

export {
  initScheduler,
  setupUserSchedule,
  updateUserSchedule
};
