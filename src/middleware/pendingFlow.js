// // src/middleware/pendingFlow.js

// import userService from '../auth/services/userService.js';
// import { ANSWER_STEPS } from '../config/constants.js';

// const pendingTimers = new Map();

// async function isFlowActive(tgId) {
//   try {
//     const user = await userService.getUserByTgId(tgId);
//     const step = user?.Answer_Step;
//     return Boolean(step && step !== 'sys_idle' && step !== ANSWER_STEPS.COMPLETED);
//   } catch (e) {
//     console.error('[pendingFlow] isFlowActive error:', e);
//     return false;
//   }
// }

// export function schedulePendingReminders(bot, tgId, label = 'Session') {
//   const id = String(tgId);

//   cancelPendingReminders(id);

//   const timeoutId = setTimeout(async () => {
//     try {
//       const active = await isFlowActive(id);
//       if (!active) return;

//       await bot.telegram.sendMessage(
//         id,
//         `⏰ Нагадування. ${label === 'Morning' ? 'Ранкові' 
//            : label === 'Evening' ? 'Вечірні' 
//            : label === 'Wheel' ? 'Колесо балансу' 
//            : label === 'Weekly' ? 'Щотижневий аналіз' 
//            : 'Сесія'} ще не завершені. Продовжимо?`,
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '🔁 Продовжити', callback_data: 'continue_answers' }],
//               [{ text: '🚪 Вийти', callback_data: 'skip_session' }]
//             ]
//           }
//         }
//       );
//     } catch (err) {
//       console.error('[pendingFlow] reminder send error:', err);
//     } finally {
//       pendingTimers.delete(id);
//     }
//   }, 10 * 60 * 1000);

//   pendingTimers.set(id, timeoutId);
// }

// export function cancelPendingReminders(tgId) {
//   const id = String(tgId);
//   const t = pendingTimers.get(id);
//   if (t) {
//     clearTimeout(t);
//     pendingTimers.delete(id);
//   }
// }

// export function installPendingFlow(bot) {
//   console.log('[pendingFlow] Installing pending flow middleware');
// }