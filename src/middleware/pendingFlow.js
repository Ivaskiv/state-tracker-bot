// src/middleware/pendingFlow.js
// ✅ Без залежності від ../aiMentor/session.js

import userService from '../auth/services/userService.js';
import { ANSWER_STEPS } from '../config/constants.js';

// Тримаємо таймери нагадувань, щоб не дублювались
const pendingTimers = new Map(); // tgId -> timeoutId

/**
 * Перевірка: чи користувач зараз у активному флоу (не sys_idle і не COMPLETED)
 */
async function isFlowActive(tgId) {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    return Boolean(step && step !== 'sys_idle' && step !== ANSWER_STEPS.COMPLETED);
  } catch (e) {
    console.error('[pendingFlow] isFlowActive error:', e);
    return false;
  }
}

/**
 * Стартує нагадування через 10 хв: якщо юзер не закінчив — запропонувати продовжити/вийти
 * @param {Telegraf} bot
 * @param {number|string} tgId
 * @param {'Morning'|'Evening'|'Wheel'|'Weekly'} label - для тексту
 */
export function schedulePendingReminders(bot, tgId, label = 'Session') {
  const id = String(tgId);

  // Якщо вже є таймер — скасовуємо
  cancelPendingReminders(id);

  const timeoutId = setTimeout(async () => {
    try {
      const active = await isFlowActive(id);
      if (!active) return; // нічого не робимо

      // Надсилаємо “повторний пінг”
      await bot.telegram.sendMessage(
        id,
        `⏰ Нагадування. ${label === 'Morning' ? 'Ранкові' 
           : label === 'Evening' ? 'Вечірні' 
           : label === 'Wheel' ? 'Колесо балансу' 
           : label === 'Weekly' ? 'Щотижневий аналіз' 
           : 'Сесія'} ще не завершені. Продовжимо?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔁 Продовжити', callback_data: 'resume_flow' }],
              [{ text: '🚪 Вийти', callback_data: 'exit_flow' }]
            ]
          }
        }
      );
    } catch (err) {
      console.error('[pendingFlow] reminder send error:', err);
    } finally {
      // Після одноразового нагадування — чистимо таймер
      pendingTimers.delete(id);
    }
  }, 10 * 60 * 1000); // 10 хвилин

  pendingTimers.set(id, timeoutId);
}

/**
 * Скасувати заплановане нагадування (коли юзер закінчив/вийшов)
 */
export function cancelPendingReminders(tgId) {
  const id = String(tgId);
  const t = pendingTimers.get(id);
  if (t) {
    clearTimeout(t);
    pendingTimers.delete(id);
  }
}
