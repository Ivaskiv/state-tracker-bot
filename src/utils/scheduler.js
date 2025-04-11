import cron from 'node-cron';
import User from '../models/user.js';

// Словник для зберігання активних задач
const scheduleTasks = {};

// Ініціалізація планувальника
async function initScheduler(bot) {
  try {
    const users = await User.find();
    await Promise.all(users.map(user => setupUserSchedule(bot, user)));
    console.log(`🗓️ Scheduled tasks for ${users.length} users`);
  } catch (err) {
    console.error('❌ Error initializing scheduler:', err);
  }
}

// Оновлення розкладу для конкретного користувача
async function updateUserSchedule(bot, userId) {
  try {
    const user = await User.findOne({ telegramId: userId });
    if (user) await setupUserSchedule(bot, user);
  } catch (err) {
    console.error(`❌ Error updating schedule for user ${userId}:`, err);
  }
}

// Створення або оновлення задачі користувача
async function setupUserSchedule(bot, user) {
  const { telegramId, frequency } = user;

  // Зупиняємо та очищаємо попередні задачі
  if (scheduleTasks[telegramId]) {
    scheduleTasks[telegramId].forEach(task => task.stop());
  }
  scheduleTasks[telegramId] = [];

  console.log(`🔁 Setting up schedule for ${telegramId} [${frequency}]`);

  // Вибір розкладу
  const setupFunctions = {
    hourly: setupHourlySchedule,
    '2hours': setup2HoursSchedule,
    morning_evening: setupMorningEveningSchedule
  };

  const setupFn = setupFunctions[frequency];
  if (setupFn) {
    setupFn(bot, user);
  } else {
    console.warn(`⚠️ Unknown frequency: ${frequency}`);
  }
}

// Перевірка, чи поточна година в діапазоні
function isWithinTimeRange(hour, start, end) {
  return hour >= start && hour <= end;
}

// Загальна функція планування задачі
function createCronTask(cronTime, conditionFn, taskFn) {
  return cron.schedule(cronTime, async () => {
    if (conditionFn()) {
      await taskFn();
    }
  });
}

// Щогодини
function setupHourlySchedule(bot, user) {
  const task = createCronTask(
    '0 * * * *',
    () => isWithinTimeRange(new Date().getHours(), user.startTime, user.endTime),
    () => sendPollNotification(bot, user)
  );
  scheduleTasks[user.telegramId].push(task);
}

// Кожні 2 години
function setup2HoursSchedule(bot, user) {
  const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  hours.forEach(h => {
    const task = createCronTask(
      `0 ${h} * * *`,
      () => isWithinTimeRange(h, user.startTime, user.endTime),
      () => sendPollNotification(bot, user)
    );
    scheduleTasks[user.telegramId].push(task);
  });
}

// Зранку та ввечері
function setupMorningEveningSchedule(bot, user) {
  const times = [9, 19]; // ранкове і вечірнє

  times.forEach(h => {
    if (isWithinTimeRange(h, user.startTime, user.endTime)) {
      const task = createCronTask(
        `0 ${h} * * *`,
        () => true,
        () => sendPollNotification(bot, user)
      );
      scheduleTasks[user.telegramId].push(task);
    }
  });
}

// Відправка повідомлення-опитування
async function sendPollNotification(bot, user) {
  try {
    console.log(`[${new Date().toISOString()}] 📩 Sending poll to ${user.telegramId}`);
    await bot.telegram.sendMessage(
      user.telegramId,
      `Привіт, ${user.name || 'користувачу'}! 🧘 Настав час перевірити твій емоційний стан.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Пройти опитування', callback_data: 'start_poll' }]
          ]
        }
      }
    );
  } catch (err) {
    console.error(`❌ Error sending poll to ${user.telegramId}:`, err);
  }
}

export {
  initScheduler,
  setupUserSchedule,
  updateUserSchedule
};
