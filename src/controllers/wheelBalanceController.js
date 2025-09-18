// src/controllers/wheelBalanceController.js

import wheelBalanceService from '../services/wheelBalanceService.js';
import userService from '../auth/services/userService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { ANSWER_STEPS } from '../config/constants.js';

const handleWheelBalanceRequest = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
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

    const result = await wheelBalanceService.startWheelBalance(tgId);
    await userService.updateUserStep(tgId, 'WheelBalance');
    
    await ctx.reply(result.message, result.keyboard);
    
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка запуску:', error);
    await typing(ctx);
    await ctx.reply('Виникла помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleWheelBalanceAnswer = async (ctx, score) => {
  const tgId = ctx.from.id;
  
  try {
    const result = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
    
    if (result.completed) {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    }
    
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка відповіді:', error);
    await ctx.reply('Виникла помилка. Спробуй ще раз.');
  }
};

const cancelActiveWheel = async (tgId) => {
  try {
    return await wheelBalanceService.cancelActiveWheel(tgId);
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка скасування:', error);
    throw error;
  }
};

const handleWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  try {
    console.log(`[wheelBalanceController] 📱 Callback: ${data} від ${tgId}`);

    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
      if (activeWheel) {
        const currentStep = activeWheel.fields.Step || 0;
        const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];
        
        await ctx.editMessageText(
          `🎯 КОЛЕСО БАЛАНСУ\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОбери оцінку:`,
          keyboards.wheelScoreInlineKeyboard()
        );
      }
      await ctx.answerCbQuery('Продовжуємо колесо балансу');
      return;
    }

    if (data === 'wheel_restart' || data === 'wheel_start_new') {
      const result = await wheelBalanceService.startWheelBalance(tgId);
      await userService.updateUserStep(tgId, 'WheelBalance');
      
      await ctx.editMessageText(result.message, result.keyboard);
      await ctx.answerCbQuery('Колесо балансу перезапущено');
      return;
    }

    if (data === 'wheel_cancel' || data === 'wheel_exit') {
      await cancelActiveWheel(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      
      await ctx.editMessageText('🚪 Колесо балансу скасовано');
      await ctx.answerCbQuery('Колесо балансу скасовано');
      
      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 1000);
      return;
    }

    if (data === 'wheel_to_menu') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.editMessageText('🏠 Повертаємося до головного меню');
      await ctx.answerCbQuery('Повернення до меню');
      
      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 1000);
      return;
    }

    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''));
      if (!isNaN(score) && score >= 0 && score <= 10) {
        const result = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
        
        if (result.completed) {
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          await ctx.answerCbQuery('Колесо балансу завершено!');
        } else if (result.error) {
          await ctx.answerCbQuery(result.message || 'Помилка');
        } else {
          await ctx.answerCbQuery('Оцінка збережена');
        }
      } else {
        await ctx.answerCbQuery('Невірна оцінка');
      }
      return;
    }
    
  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка callback:', error);
    await ctx.answerCbQuery('Виникла помилка');
  }
};

const handleWheelRetryCallback = async (ctx) => {
  await handleWheelCallback(ctx);
};

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
  handleWheelBalanceAnswer,
  handleWheelCallback,
  handleWheelRetryCallback,
  checkMonthlyWheelNeed,
  cancelActiveWheel
};