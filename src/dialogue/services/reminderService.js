// src/services/reminderService.js
import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const activeReminders = new Map();

export const setQuestionReminders = (bot, tgId, questionType) => {
  // Очищуємо попередні нагадування
  clearQuestionReminders(tgId);
  
  const reminderText = questionType === 'morning' 
    ? '🔔 Не забудь відповісти на ранкові питання!'
    : '🔔 Час для вечірньої рефлексії!';
  
  // Перше нагадування через 10 хвилин
  const timeout1 = setTimeout(async () => {
    try {
      const user = await userService.getUserByTelegramId(tgId);
      const step = user?.Answer_Step;
      
      // Якщо користувач ще в процесі відповідей
      if (step && step.startsWith('Q_') && step !== ANSWER_STEPS.COMPLETED) {
        await bot.telegram.sendMessage(tgId, reminderText, keyboards.continueAnswersKeyboard());
      }
    } catch (error) {
      console.error('[reminderService] Помилка першого нагадування:', error);
    }
  }, 10 * 60 * 1000); // 10 хвилин
  
  // Друге нагадування через 60 хвилин
  const timeout2 = setTimeout(async () => {
    try {
      const user = await userService.getUserByTelegramId(tgId);
      const step = user?.Answer_Step;
      
      // Якщо користувач ще в процесі відповідей
      if (step && step.startsWith('Q_') && step !== ANSWER_STEPS.COMPLETED) {
        await bot.telegram.sendMessage(tgId, 
          `${reminderText}\n\n⚠️ Останнє нагадування!`, 
          keyboards.continueAnswersKeyboard()
        );
      }
    } catch (error) {
      console.error('[reminderService] Помилка другого нагадування:', error);
    }
  }, 60 * 60 * 1000); // 60 хвилин
  
  // Зберігаємо таймери
  activeReminders.set(tgId, { timeout1, timeout2 });
};

export const clearQuestionReminders = (tgId) => {
  const reminders = activeReminders.get(tgId);
  if (reminders) {
    clearTimeout(reminders.timeout1);
    clearTimeout(reminders.timeout2);
    activeReminders.delete(tgId);
  }
};

export default {
  setQuestionReminders,
  clearQuestionReminders
};