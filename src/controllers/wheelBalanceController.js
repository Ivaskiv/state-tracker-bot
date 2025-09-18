// src/controllers/wheelBalanceController.js - НОВИЙ КОНТРОЛЕР ДЛЯ КОЛЕСА

import wheelBalanceService from '../services/wheelBalanceService.js';
import userService from '../auth/services/userService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { ANSWER_STEPS } from '../config/constants.js';

const handleWheelBalanceRequest = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    // Перевіряємо підписку
    const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
    if (!subscriptionStatus.active) {
      await typing(ctx);
      await ctx.reply(
        '🎯 Колесо балансу доступне тільки з активною підпискою.\n\nОформи підписку для доступу до всіх функцій!',
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

    await typing(ctx);
    
    // Перевіряємо активне колесо
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    if (activeWheel) {
      const currentStep = activeWheel.fields.Step || 0;
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];
      
      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу!\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОбери дію:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити', callback_data: 'wheel_continue' }],
              [{ text: '🔄 Почати знову', callback_data: 'wheel_restart' }],
              [{ text: '❌ Скасувати', callback_data: 'wheel_cancel' }]
            ]
          }
        }
      );
      return;
    }

    // Запускаємо нове колесо
    const result = await wheelBalanceService.startWheelBalance(tgId);
    await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
    
    await ctx.reply(result.message, result.keyboard);
    
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка запуску:', error);
    await typing(ctx);
    await ctx.reply('Виникла помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  try {
    // Продовження існуючого колеса
    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
      if (activeWheel) {
        const currentStep = activeWheel.fields.Step || 0;
        const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];
        
        await ctx.editMessageText(
          `🎯 КОЛЕСО БАЛАНСУ\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОбери оцінку:`,
          wheelBalanceService.createScoreKeyboard(currentStep + 1, 8)
        );
      }
      await ctx.answerCbQuery('Продовжуємо колесо балансу');
      return;
    }

    // Перезапуск колеса
    if (data === 'wheel_restart') {
      const result = await wheelBalanceService.startWheelBalance(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
      
      await ctx.editMessageText(result.message, result.keyboard);
      await ctx.answerCbQuery('Колесо балансу перезапущено');
      return;
    }

    // Скасування колеса
    if (data === 'wheel_cancel') {
      await wheelBalanceService.cancelActiveWheel(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      
      await ctx.editMessageText('🚪 Колесо балансу скасовано');
      await ctx.answerCbQuery('Колесо балансу скасовано');
      return;
    }

    // Обробка оцінок та інших дій
    const result = await wheelBalanceService.processWheelCallback(ctx);
    
    if (result.completed) {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      if (!result.cancelled) {
        await ctx.answerCbQuery('Колесо балансу завершено!');
      }
    } else if (result.error) {
      await ctx.answerCbQuery(result.message || 'Помилка');
    } else {
      await ctx.answerCbQuery('Оцінка збережена');
    }
    
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка callback:', error);
    await ctx.answerCbQuery('Виникла помилка');
  }
};

// Щомісячна перевірка потреби в колесі балансу
const checkMonthlyWheelNeed = async (bot) => {
  try {
    const users = await userService.getActiveUsers();
    
    for (const user of users) {
      const tgId = user['TG_id'];
      const needsWheel = await wheelBalanceService.needsWheelBalance(tgId);
      
      if (needsWheel) {
        await bot.telegram.sendMessage(
          tgId,
          '🎯 Час оновити колесо балансу!\n\nМинув місяць з останньої оцінки. Хочеш проаналізувати поточний стан життєвих сфер?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Пройти колесо балансу', callback_data: 'wheel_monthly_start' }],
                [{ text: '⏰ Нагадати пізніше', callback_data: 'wheel_remind_later' }]
              ]
            }
          }
        );
      }
    }
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка щомісячної перевірки:', error);
  }
};

export default {
  handleWheelBalanceRequest,
  handleWheelCallback,
  checkMonthlyWheelNeed
};