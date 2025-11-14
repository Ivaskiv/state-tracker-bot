//src/services/reminderScheduler.js
// Універсальна система нагадувань
const reminders = new Map(); // userId -> { timerId, callback }

export const scheduleReminder = (userId, delayMs, callback) => {
  cancelReminder(userId);
  
  const timerId = setTimeout(async () => {
    try {
      await callback();
      reminders.delete(userId);
    } catch (error) {
      console.error('[reminderScheduler]', error);
    }
  }, delayMs);
  
  reminders.set(userId, { timerId, callback });
};

export const cancelReminder = (userId) => {
  const reminder = reminders.get(userId);
  if (reminder) {
    clearTimeout(reminder.timerId);
    reminders.delete(userId);
  }
};

export default { scheduleReminder, cancelReminder };