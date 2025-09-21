// src/controllers/wheelBalanceController.js - ДОДАНО ЩОМІСЯЧНУ ПЕРЕВІРКУ
import wheelBalanceService from '../services/wheelBalanceService.js';
import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { ANSWER_STEPS, OB_STEPS } from '../config/constants.js';
import path from 'path';

// ———————————————————————————————————————————————
// ПЕРЕВІРКА ДОСТУПУ
// ———————————————————————————————————————————————

function hasActiveAccessOrSession(ctx, user) {
  if (userService.hasActiveAccess?.(user)) return true;
  if (ctx?.session?.trialJustActivated) return true;
  const step = ctx?.session?.step;
  if ([OB_STEPS.PAYMENT_SUCCESS, OB_STEPS.REMINDERS_INTRO, OB_STEPS.DONE].includes(step)) return true;
  return false;
}

// ———————————————————————————————————————————————
// ОСНОВНІ ОПЕРАЦІЇ
// ———————————————————————————————————————————————

const handleWheelBalance = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';
    
    // Отримуємо дату реєстрації користувача
    const user = await userService.getUserByTelegramId(tgId);
    const registrationDate = user?.['Registration Date'] || user?.Created_Date || new Date().toISOString();
    
    console.log(`🎯 [wheelController] Запуск колеса для ${tgId}, реєстрація: ${registrationDate}`);

    // Очищаємо сесію
    if (ctx.session) {
      ctx.session.wheel = null;
    }

    // Отримуємо результат перевірки та рекомендації
    const result = await wheelBalanceService.handleWheelBalanceRequest(tgId, userName, registrationDate);
    
    console.log(`🎯 [wheelController] Результат:`, result.type);
    
    // Відправляємо відповідь залежно від типу
    await ctx.reply(result.message, result.keyboard);

  } catch (error) {
    console.error('❌ [wheelController] Помилка:', error);
    await ctx.reply(
      '❌ Виникла помилка при запуску колеса балансу.\n\nСпробуй пізніше або зверніться до підтримки.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  }
};

const handleWheelBalanceRequest = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    console.log(`🎯 [wheelBalanceController] Запит на колесо від ${tgId}`);
    
    const user = await userService.getUserByTelegramId(tgId);

    if (!hasActiveAccessOrSession(ctx, user)) {
      console.log(`🎯 [wheelBalanceController] ❌ Немає доступу для ${tgId}`);
      await typing(ctx);
      await ctx.reply(
        '🎯 Колесо балансу доступне тільки з активною підпискою.\n\nАктивуй підписку в меню «💰 Підписка».',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Підписка', callback_data: 'subscription_info' }]
            ]
          }
        }
      );
      return;
    }

    console.log(`🎯 [wheelBalanceController] ✅ Доступ підтверджено для ${tgId}`);
    await typing(ctx);

    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    
    if (activeWheel) {
      console.log(`🎯 [wheelBalanceController] 🔄 Знайдено активне колесо для ${tgId}, Step: ${activeWheel.fields.Step}`);
      
      const currentStep = Number(activeWheel.fields.Step || 0);
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];

      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу.\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\n⚠️ Поки триває сесія колеса, інші дії та меню заблоковані.\n\nЩо робимо?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити колесо', callback_data: 'wheel_continue' }],
              [{ text: '🚪 Вийти із сесії', callback_data: 'wheel_exit' }]
            ]
          }
        }
      );
      return;
    }

    console.log(`🎯 [wheelBalanceController] 🆕 Створення нового колеса для ${tgId}`);

    const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
    await userService.updateUserStep(tgId, 'WheelBalance');

    try {
      const imagePath = path.join(process.cwd(), 'src', 'img', 'koleso_balansu.png');
      
      await ctx.replyWithPhoto(
        { source: imagePath },
        {
          caption: start.message,
          ...start.keyboard
        }
      );
      
      console.log(`🎯 [wheelBalanceController] ✅ Колесо запущено з зображенням для ${tgId}`);
    } catch (imageError) {
      console.warn(`🎯 [wheelBalanceController] ⚠️ Не вдалося надіслати зображення для ${tgId}:`, imageError);
      
      await ctx.reply(start.message, start.keyboard);
      console.log(`🎯 [wheelBalanceController] ✅ Колесо запущено без зображення для ${tgId}`);
    }

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка запуску колеса:', error);
    await typing(ctx);
    await ctx.reply('Виникла помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleWheelNoteText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = (ctx.message?.text || '').trim();
  
  if (!ctx.session?.wheel?.awaitingNoteFor && ctx.session?.wheel?.awaitingNoteFor !== 0) {
    return false;
  }
  
  if (!text || text.length < 5) {
    await ctx.reply('Додай, будь ласка, ще трішки деталей (2–5 речень) про цю сферу життя.');
    return true;
  }

  console.log(`🎯 [wheelBalanceController] 📝 Обробка нотатки від ${tgId}: "${text.substring(0, 50)}..."`);

  try {
    const res = await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
    
    if (res.error) {
      await ctx.reply(res.message || 'Помилка збереження нотатки. Спробуй ще раз.');
      return true;
    }
    
    if (res.completed) {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.reply(res.message, keyboards.wheelBalanceCompleteKeyboard());
      console.log(`🎯 [wheelBalanceController] ✅ Колесо завершено для ${tgId}`);
    } else {
      await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreInlineKeyboard());
      console.log(`🎯 [wheelBalanceController] ➡️ Наступна сфера для ${tgId}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка обробки нотатки:', error);
    await ctx.reply('Виникла помилка. Спробуй ще раз.');
    return true;
  }
};

const handleWheelBalanceAnswer = async (ctx, score) => {
  const tgId = ctx.from.id;
  
  console.log(`🎯 [wheelBalanceController] 📊 Оцінка ${score} від ${tgId}`);

  try {
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    
    if (step !== 'WheelBalance') {
      console.log(`🎯 [wheelBalanceController] ❌ Колесо неактивне для ${tgId}, step: ${step}`);
      await ctx.reply('Колесо балансу неактивне. Натисни "🎯 Колесо балансу" в меню.', keyboards.mainMenuKeyboard());
      return;
    }

    const res = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
    
    if (res.error) {
      await ctx.reply(res.message || 'Помилка збереження оцінки');
      return;
    }

    console.log(`🎯 [wheelBalanceController] ✅ Оцінка збережена, чекаємо нотатку для сфери ${res.awaitingNoteFor}`);

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка обробки оцінки:', error);
    await ctx.reply('Виникла помилка. Спробуй ще раз.');
  }
};

// ———————————————————————————————————————————————
// ОБРОБКА CALLBACK-ІВ
// ———————————————————————————————————————————————

const handleWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  try {
    console.log(`🎯 [wheelBalanceController] 📱 Callback: ${data} від ${tgId}`);

    if (data === 'wheel_start' || data === 'wheel_restart' || data === 'wheel_start_new') {
      console.log(`🎯 [wheelBalanceController] 🚀 ЗАПУСК НОВОГО КОЛЕСА`);
      
      const user = await userService.getUserByTelegramId(tgId);
      
      if (!hasActiveAccessOrSession(ctx, user)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }
      
      const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
      await userService.updateUserStep(tgId, 'WheelBalance');

      try {
        await ctx.editMessageText(start.message, start.keyboard);
      } catch {
        await ctx.reply(start.message, start.keyboard);
      }
      await ctx.answerCbQuery('Колесо запущено');
      return;
    }

    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);

      if (!activeWheel) {
        console.log(`🎯 [wheelBalanceController] ❌ Активне колесо не знайдено для ${tgId}`);
        const user = await userService.getUserByTelegramId(tgId);
        const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
        await userService.updateUserStep(tgId, 'WheelBalance');
        
        try {
          await ctx.editMessageText(start.message, start.keyboard);
        } catch {
          await ctx.reply(start.message, start.keyboard);
        }
        await ctx.answerCbQuery('Починаємо спочатку');
        return;
      }

      const step = Number(activeWheel.fields.Step || 0);
      const sphereName = wheelBalanceService.LIFE_SPHERES[step];

      const message = `🎯 КОЛЕСО БАЛАНСУ\n\n${step + 1}️⃣/8 ${sphereName}\n\nОбери оцінку від 0 до 10:`;

      try {
        await ctx.editMessageText(message, keyboards.wheelScoreInlineKeyboard());
      } catch {
        await ctx.reply(message, keyboards.wheelScoreInlineKeyboard());
      }

      await userService.updateUserStep(tgId, 'WheelBalance');
      await ctx.answerCbQuery('Продовжуємо колесо');
      return;
    }

    if (data === 'wheel_cancel' || data === 'wheel_exit') {
      await wheelBalanceService.cancelActiveWheel(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

      try {
        await ctx.editMessageText('🚪 Колесо балансу скасовано. Повертаємося до меню.');
      } catch {
        await ctx.reply('🚪 Колесо балансу скасовано. Повертаємося до меню.');
      }
      await ctx.answerCbQuery('Сесію завершено');

      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 700);
      return;
    }

    if (data === 'wheel_info') {
      const info = wheelBalanceService.getWheelInfo();
      await ctx.editMessageText(info.message, info.keyboard);
      return;
    }

    if (data === 'wheel_stats') {
      const stats = await wheelBalanceService.getUserWheelStats(tgId);
      let message = '📊 ТВОЯ СТАТИСТИКА КОЛІС БАЛАНСУ\n\n';
      
      if (stats.total === 0) {
        message += 'Ти ще не заповнила жодного колеса балансу.\nЧас почати! 🎯';
      } else {
        message += `📈 Всього заповнено: ${stats.total}\n`;
        if (stats.lastScore) {
          message += `⭐ Останній бал: ${stats.lastScore}/10\n`;
        }
        if (stats.lastDate) {
          const daysSince = Math.floor((new Date() - new Date(stats.lastDate)) / (1000 * 60 * 60 * 24));
          message += `📅 Останнє колесо: ${daysSince} днів тому\n`;
        }
        message += '\nПродовжуй відслідковувати свій прогрес! 💪';
      }
      
      await ctx.editMessageText(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Нове колесо', callback_data: 'wheel_start' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      return;
    }

    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''), 10);
      if (Number.isNaN(score) || score < 0 || score > 10) {
        await ctx.answerCbQuery('Невірна оцінка');
        return;
      }

      await handleWheelBalanceAnswer(ctx, score);
      await ctx.answerCbQuery('Оцінка збережена');
      return;
    }

    if (data === 'wheel_to_menu') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      try { 
        await ctx.editMessageText('🏠 Повертаємося до головного меню'); 
      } catch {}
      await ctx.answerCbQuery('Меню');

      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 700);
      return;
    }

    console.log(`🎯 [wheelBalanceController] ❓ Невідомий callback: ${data}`);
    await ctx.answerCbQuery('Невідома команда');

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка callback:', error);
    try { 
      await ctx.answerCbQuery('Виникла помилка'); 
    } catch {}
  }
};

// ———————————————————————————————————————————————
// ✅ ЩОМІСЯЧНА ПЕРЕВІРКА ПОТРЕБИ В КОЛЕСІ
// ———————————————————————————————————————————————

const checkMonthlyWheelNeed = async (bot) => {
  try {
    console.log('🎯 [wheelBalanceController] 📅 ПОЧАТОК щомісячної перевірки коліс балансу');
    
    const remindersSent = await wheelBalanceService.sendMonthlyWheelReminders(bot);
    
    console.log(`🎯 [wheelBalanceController] ✅ Щомісячна перевірка завершена, надіслано ${remindersSent} нагадувань`);
    return remindersSent;
    
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка щомісячної перевірки:', error);
    return 0;
  }
};

// ———————————————————————————————————————————————
// ЕКСПОРТИ
// ———————————————————————————————————————————————

export default {
  handleWheelBalance,
  handleWheelBalanceRequest,
  handleWheelBalanceAnswer,
  handleWheelNoteText,
  handleWheelCallback,
  checkMonthlyWheelNeed  // ✅ ДОДАНО ЕКСПОРТ
};