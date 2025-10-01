// // src/controllers/wheelBalanceController.js - ВИПРАВЛЕНО З ЛОГІЧНИМИ ПОВІДОМЛЕННЯМИ
// import wheelBalanceService from '../services/wheelBalanceService.js';
// import userService from '../services/userService.js';
// import keyboards from '../utils/keyboards.js';
// import typing from '../utils/typing.js';
// import { ANSWER_STEPS, OB_STEPS } from '../config/constants.js';
// import path from 'path';

// // ———————————————————————————————————————————————
// // ПЕРЕВІРКА ДОСТУПУ
// // ———————————————————————————————————————————————

// function hasActiveAccessOrSession(ctx, user) {
//   if (userService.hasActiveAccess?.(user)) return true;
//   if (ctx?.session?.trialJustActivated) return true;
//   const step = ctx?.session?.step;
//   if ([OB_STEPS.PAYMENT_SUCCESS, OB_STEPS.REMINDERS_INTRO, OB_STEPS.DONE].includes(step)) return true;
//   return false;
// }

// // ———————————————————————————————————————————————
// // ОСНОВНІ ОПЕРАЦІЇ
// // ———————————————————————————————————————————————

// const handleWheelBalance = async (ctx) => {
//   try {
//     const tgId = ctx.from.id;
//     const userName = ctx.from.first_name || 'Користувач';
    
//     // Отримуємо дату реєстрації користувача
//     const user = await userService.getUserByTgId(tgId);
//     const registrationDate = user?.['Registration Date'] || user?.Created_Date || new Date().toISOString();
    
//     console.log(`🎯 [wheelController] Запуск колеса для ${tgId}, реєстрація: ${registrationDate}`);

//     // Очищаємо сесію
//     if (ctx.session) {
//       ctx.session.wheel = null;
//     }

//     // Отримуємо результат перевірки та рекомендації
//     const result = await wheelBalanceService.handleWheelBalanceRequest(tgId, userName, registrationDate);
    
//     console.log(`🎯 [wheelController] Результат:`, result.type);
    
//     // Відправляємо відповідь залежно від типу
//     await ctx.reply(result.message, result.keyboard);

//   } catch (error) {
//     console.error('❌ [wheelController] Помилка:', error);
//     await ctx.reply(
//       '❌ Виникла помилка при запуску колеса балансу.\n\n💡 Спробуй пізніше або зверніся до підтримки для вирішення технічних питань.',
//       {
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }],
//             [{ text: '🏠 До меню', callback_data: 'main_menu' }]
//           ]
//         }
//       }
//     );
//   }
// };

// const handleWheelBalanceRequest = async (ctx) => {
//   const tgId = ctx.from.id;

//   try {
//     console.log(`🎯 [wheelBalanceController] Запит на колесо від ${tgId}`);
    
//     const user = await userService.getUserByTgId(tgId);

//     if (!hasActiveAccessOrSession(ctx, user)) {
//       console.log(`🎯 [wheelBalanceController] ❌ Немає доступу для ${tgId}`);
//       await typing(ctx);
//       await ctx.reply(
//         '🎯 Колесо балансу — преміум інструмент!\n\n📊 Отримай детальний аналіз 8 сфер життя з персональними рекомендаціями.\n\n💰 Активуй підписку для доступу до всіх функцій.',
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '💰 Переглянути плани', callback_data: 'subscription_info' }],
//               [{ text: '🏠 До меню', callback_data: 'main_menu' }]
//             ]
//           }
//         }
//       );
//       return;
//     }

//     console.log(`🎯 [wheelBalanceController] ✅ Доступ підтверджено для ${tgId}`);
//     await typing(ctx);

//     const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    
//     if (activeWheel) {
//       console.log(`🎯 [wheelBalanceController] 🔄 Знайдено активне колесо для ${tgId}, Step: ${activeWheel.fields.Step}`);
      
//       const currentStep = Number(activeWheel.fields.Step || 0);
//       const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];

//       await ctx.reply(
//         `🎯 У тебе є незавершене колесо балансу!\n\n📍 Поточна сфера: ${currentStep + 1}️⃣/8 «${sphereName}»\n\n⚠️ Під час заповнення колеса інші дії заблоковані для точного результату.\n\n🎯 Продовжимо або почнемо заново?`,
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [{ text: '▶️ Продовжити колесо', callback_data: 'wheel_continue' }],
//               [{ text: '🔄 Почати заново', callback_data: 'wheel_restart' }],
//               [{ text: '🚪 Вийти із сесії', callback_data: 'wheel_exit' }]
//             ]
//           }
//         }
//       );
//       return;
//     }

//     console.log(`🎯 [wheelBalanceController] 🆕 Створення нового колеса для ${tgId}`);

//     const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
//     await userService.updateUserStep(tgId, 'WheelBalance');

//     try {
//       const imagePath = path.join(process.cwd(), 'src', 'img', 'koleso_balansu.png');
      
//       await ctx.replyWithPhoto(
//         { source: imagePath },
//         {
//           caption: start.message,
//           ...start.keyboard
//         }
//       );
      
//       console.log(`🎯 [wheelBalanceController] ✅ Колесо запущено з зображенням для ${tgId}`);
//     } catch (imageError) {
//       console.warn(`🎯 [wheelBalanceController] ⚠️ Не вдалося надіслати зображення для ${tgId}:`, imageError);
      
//       await ctx.reply(start.message, start.keyboard);
//       console.log(`🎯 [wheelBalanceController] ✅ Колесо запущено без зображення для ${tgId}`);
//     }

//   } catch (error) {
//     console.error('❌ [wheelBalanceController] Помилка запуску колеса:', error);
//     await typing(ctx);
//     await ctx.reply(
//       '❌ Технічна помилка запуску колеса.\n\n🔧 Спробуй через хвилину або зверніся до підтримки.',
//       keyboards.mainMenuKeyboard()
//     );
//   }
// };

// const handleWheelNoteText = async (ctx) => {
//   const tgId = ctx.from.id;
//   const text = (ctx.message?.text || '').trim();
  
//   if (!ctx.session?.wheel?.awaitingNoteFor && ctx.session?.wheel?.awaitingNoteFor !== 0) {
//     return false;
//   }
  
//   if (!text || text.length < 10) {
//     await ctx.reply(
//       '✍️ Додай трохи більше деталей (2–5 речень).\n\n💡 Опиши, чому поставила саме таку оцінку - це допоможе AI створити точніший аналіз.',
//       wheelBalanceService.buildExitKeyboard()
//     );
//     return true;
//   }

//   console.log(`🎯 [wheelBalanceController] 📝 Обробка нотатки від ${tgId}: "${text.substring(0, 50)}..."`);

//   try {
//     const res = await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
    
//     if (res.error) {
//       await ctx.reply(
//         res.message || '❌ Помилка збереження нотатки.\n\n🔄 Спробуй ще раз або натисни "🚪 Вийти" для завершення.',
//         wheelBalanceService.buildExitKeyboard()
//       );
//       return true;
//     }
    
//     if (res.completed) {
//       await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
//       await ctx.reply(res.message, keyboards.wheelBalanceCompleteKeyboard());
//       console.log(`🎯 [wheelBalanceController] ✅ Колесо завершено для ${tgId}`);
//     } else {
//       await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreInlineKeyboard());
//       console.log(`🎯 [wheelBalanceController] ➡️ Наступна сфера для ${tgId}`);
//     }
    
//     return true;
//   } catch (error) {
//     console.error('❌ [wheelBalanceController] Помилка обробки нотатки:', error);
//     await ctx.reply(
//       '❌ Технічна помилка збереження.\n\n🔄 Спробуй ще раз через хвилину.',
//       wheelBalanceService.buildExitKeyboard()
//     );
//     return true;
//   }
// };

// const handleWheelBalanceAnswer = async (ctx, score) => {
//   const tgId = ctx.from.id;
  
//   console.log(`🎯 [wheelBalanceController] 📊 Оцінка ${score} від ${tgId}`);

//   try {
//     const user = await userService.getUserByTgId(tgId);
//     const step = user?.Answer_Step;
    
//     if (step !== 'WheelBalance') {
//       console.log(`🎯 [wheelBalanceController] ❌ Колесо неактивне для ${tgId}, step: ${step}`);
//       await ctx.reply(
//         '⚠️ Сесія колеса балансу неактивна.\n\n🎯 Запусти нове колесо балансу через головне меню для отримання актуального аналізу.',
//         keyboards.mainMenuKeyboard()
//       );
//       return;
//     }

//     const res = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
    
//     if (res.error) {
//       await ctx.reply(
//         res.message || '❌ Помилка збереження оцінки.\n\n🔄 Спробуй обрати оцінку ще раз.',
//         wheelBalanceService.buildExitKeyboard()
//       );
//       return;
//     }

//     console.log(`🎯 [wheelBalanceController] ✅ Оцінка збережена, чекаємо нотатку для сфери ${res.awaitingNoteFor}`);

//   } catch (error) {
//     console.error('❌ [wheelBalanceController] Помилка обробки оцінки:', error);
//     await ctx.reply(
//       '❌ Технічна помилка обробки оцінки.\n\n🔄 Спробуй ще раз або зверніся до підтримки.',
//       wheelBalanceService.buildExitKeyboard()
//     );
//   }
// };

// // ———————————————————————————————————————————————
// // ОБРОБКА CALLBACK-ІВ
// // ———————————————————————————————————————————————

// const handleWheelCallback = async (ctx) => {
//   const tgId = ctx.from.id;
//   const data = ctx.callbackQuery.data;

//   try {
//     console.log(`🎯 [wheelBalanceController] 📱 Callback: ${data} від ${tgId}`);

//     if (data === 'wheel_start' || data === 'wheel_restart' || data === 'wheel_start_new') {
//       console.log(`🎯 [wheelBalanceController] 🚀 ЗАПУСК НОВОГО КОЛЕСА`);
      
//       const user = await userService.getUserByTgId(tgId);
      
//       if (!hasActiveAccessOrSession(ctx, user)) {
//         await ctx.answerCbQuery('Потрібна активна підписка');
//         return;
//       }
      
//       const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
//       await userService.updateUserStep(tgId, 'WheelBalance');

//       try {
//         await ctx.editMessageText(start.message, start.keyboard);
//       } catch {
//         await ctx.reply(start.message, start.keyboard);
//       }
//       await ctx.answerCbQuery('🎯 Колесо запущено');
//       return;
//     }

//     if (data === 'wheel_continue') {
//       const activeWheel = await wheelBalanceService.getActiveWheel(tgId);

//       if (!activeWheel) {
//         console.log(`🎯 [wheelBalanceController] ❌ Активне колесо не знайдено для ${tgId}`);
//         const user = await userService.getUserByTgId(tgId);
//         const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
//         await userService.updateUserStep(tgId, 'WheelBalance');
        
//         try {
//           await ctx.editMessageText(start.message, start.keyboard);
//         } catch {
//           await ctx.reply(start.message, start.keyboard);
//         }
//         await ctx.answerCbQuery('🆕 Починаємо нове колесо');
//         return;
//       }

//       const step = Number(activeWheel.fields.Step || 0);
//       const sphereName = wheelBalanceService.LIFE_SPHERES[step];

//       const message = `🎯 КОЛЕСО БАЛАНСУ\n\n${step + 1}️⃣/8 ${sphereName}\n\n📊 Оціни цю сферу від 0 до 10:`;

//       try {
//         await ctx.editMessageText(message, keyboards.wheelScoreInlineKeyboard());
//       } catch {
//         await ctx.reply(message, keyboards.wheelScoreInlineKeyboard());
//       }

//       await userService.updateUserStep(tgId, 'WheelBalance');
//       await ctx.answerCbQuery('▶️ Продовжуємо колесо');
//       return;
//     }

//     if (data === 'wheel_cancel' || data === 'wheel_exit') {
//       await wheelBalanceService.cancelActiveWheel(tgId);
//       await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

//       try {
//         await ctx.editMessageText(
//           '🚪 Сесію колеса завершено.\n\n💡 Регулярне заповнення колеса (раз на місяць) допомагає відслідковувати прогрес у розвитку та підтримувати баланс у всіх сферах життя.'
//         );
//       } catch {
//         await ctx.reply(
//           '🚪 Сесію колеса завершено.\n\n💡 Регулярне заповнення колеса (раз на місяць) допомагає відслідковувати прогрес у розвитку та підтримувати баланс у всіх сферах життя.'
//         );
//       }
//       await ctx.answerCbQuery('✅ Сесію завершено');

//       setTimeout(async () => {
//         await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
//       }, 1000);
//       return;
//     }

//     if (data === 'wheel_info') {
//       const info = wheelBalanceService.getWheelInfo();
//       await ctx.editMessageText(info.message, info.keyboard);
//       await ctx.answerCbQuery('ℹ️ Інформація про колесо');
//       return;
//     }

//     if (data === 'wheel_stats') {
//       const stats = await wheelBalanceService.getUserWheelStats(tgId);
//       let message = '📊 СТАТИСТИКА КОЛІС БАЛАНСУ\n\n';
      
//       if (stats.total === 0) {
//         message += 'Ти ще не заповнила жодного колеса балансу.\n\n';
//         message += '🎯 Перше колесо дасть:\n';
//         message += '• Чітке розуміння поточного стану\n';
//         message += '• Персональні рекомендації від AI\n';
//         message += '• План розвитку на місяць\n\n';
//         message += '⏰ Час почати!';
//       } else {
//         message += `📈 Всього заповнено: ${stats.total}\n`;
        
//         if (stats.lastScore) {
//           message += `⭐ Останній середній бал: ${stats.lastScore}/10\n`;
//         }
        
//         if (stats.lastDate) {
//           const daysSince = Math.floor((new Date() - new Date(stats.lastDate)) / (1000 * 60 * 60 * 24));
//           message += `📅 Останнє колесо: ${daysSince} днів тому\n\n`;
          
//           if (daysSince >= 30) {
//             message += '⏰ Час для нового колеса!\n';
//             message += '📈 Регулярний моніторинг допомагає:\n';
//             message += '• Бачити прогрес у розвитку\n';
//             message += '• Підтримувати баланс\n';
//             message += '• Вчасно коригувати пріоритети';
//           } else {
//             message += `📅 Наступне рекомендоване: через ${30 - daysSince} днів\n\n`;
//             message += '💪 Відмінна регулярність! Продовжуй відслідковувати прогрес.';
//           }
//         } else {
//           message += '\n💡 Продовжуй заповнювати колесо регулярно для кращого аналізу прогресу.';
//         }
//       }
      
//       await ctx.editMessageText(message, {
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '🎯 Нове колесо', callback_data: 'wheel_start' }],
//             [{ text: '🏠 До меню', callback_data: 'main_menu' }]
//           ]
//         }
//       });
//       await ctx.answerCbQuery('📊 Статистика завантажена');
//       return;
//     }

//     if (data.startsWith('wheel_score_')) {
//       const score = parseInt(data.replace('wheel_score_', ''), 10);
//       if (Number.isNaN(score) || score < 0 || score > 10) {
//         await ctx.answerCbQuery('❌ Невірна оцінка');
//         return;
//       }

//       await handleWheelBalanceAnswer(ctx, score);
//       await ctx.answerCbQuery(`✅ Оцінка ${score} збережена`);
//       return;
//     }

//     if (data === 'wheel_to_menu') {
//       await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
//       try { 
//         await ctx.editMessageText(
//           '🏠 Повертаємося до головного меню.\n\n📈 Твій прогрес збережено. Переглянути результати можна в розділі "📊 Мій прогрес".'
//         ); 
//       } catch {}
//       await ctx.answerCbQuery('🏠 До меню');

//       setTimeout(async () => {
//         await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
//       }, 1000);
//       return;
//     }

//     console.log(`🎯 [wheelBalanceController] ❓ Невідомий callback: ${data}`);
//     await ctx.answerCbQuery('❓ Команда не розпізнана');

//   } catch (error) {
//     console.error('❌ [wheelBalanceController] Помилка callback:', error);
//     try { 
//       await ctx.answerCbQuery('❌ Технічна помилка'); 
//     } catch {}
//   }
// };

// // ———————————————————————————————————————————————
// // ✅ ЩОМІСЯЧНА ПЕРЕВІРКА ПОТРЕБИ В КОЛЕСІ
// // ———————————————————————————————————————————————

// const checkMonthlyWheelNeed = async (bot) => {
//   try {
//     console.log('🎯 [wheelBalanceController] 📅 ПОЧАТОК щомісячної перевірки коліс балансу');
    
//     const remindersSent = await wheelBalanceService.sendMonthlyWheelReminders(bot);
    
//     console.log(`🎯 [wheelBalanceController] ✅ Щомісячна перевірка завершена, надіслано ${remindersSent} нагадувань`);
//     return remindersSent;
    
//   } catch (error) {
//     console.error('❌ [wheelBalanceController] Помилка щомісячної перевірки:', error);
//     return 0;
//   }
// };

// // ———————————————————————————————————————————————
// // ЕКСПОРТИ
// // ———————————————————————————————————————————————

// export default {
//   handleWheelBalance,
//   handleWheelBalanceRequest,
//   handleWheelBalanceAnswer,
//   handleWheelNoteText,
//   handleWheelCallback,
//   checkMonthlyWheelNeed
// };