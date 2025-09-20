// src/controllers/wheelBalanceController.js
// Trial = повний доступ одразу; підчистили текст від підказок про меню

import wheelBalanceService from '../services/wheelBalanceService.js';
import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { ANSWER_STEPS, OB_STEPS } from '../config/constants.js';

function hasActiveAccess(user) {
  if (!user) return false;

  const activeSub = String(user['Active_Subscription_Status'] || '');
  const status    = String(user['Subscription Status'] || '');
  const plan      = String(user['Active Subscription Plan'] || '');
  const endIso    = user['End_Date'];

  if (activeSub.includes('✅ Активна') || status === 'Active') return true;

  if (/пробн|trial/i.test(plan)) {
    try {
      const now = Date.now();
      const end = endIso ? Date.parse(endIso) : 0;
      if (end && end > now) return true;
    } catch {}
  }

  return false;
}

// одразу після активації trial в онбордингу — пропускаємо перевірки БД
function hasActiveAccessOrSession(ctx, user) {
  if (hasActiveAccess(user)) return true;
  if (ctx?.session?.trialJustActivated) return true;

  const step = ctx?.session?.step;
  if ([OB_STEPS.PAYMENT_SUCCESS, OB_STEPS.REMINDERS_INTRO, OB_STEPS.DONE].includes(step)) {
    return true;
  }
  return false;
}

const handleWheelBalanceRequest = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const user = await userService.getUserByTelegramId(tgId);

    if (!hasActiveAccessOrSession(ctx, user)) {
      await typing(ctx);
      await ctx.reply(
        '🎯 Колесо балансу доступне тільки з активною підпискою.',
        { reply_markup: { inline_keyboard: [[{ text: '💰 Підписка', callback_data: 'subscription_info' }]] } }
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

    // ▶️ Універсальна функція показу питання з клавіатурою
    const showWheelStep = async (stepIndex = 0) => {
      const sphereName = wheelBalanceService.LIFE_SPHERES[stepIndex] || wheelBalanceService.LIFE_SPHERES[0];
      const message = `🎯 КОЛЕСО БАЛАНСУ\n\n${stepIndex + 1}️⃣/8 ${sphereName}\n\nОбери оцінку:`;
      // Спробуємо редагувати, але якщо ні — надішлемо нове
      try {
        await ctx.editMessageText(message, keyboards.wheelScoreInlineKeyboard());
      } catch {
        await ctx.reply(message, keyboards.wheelScoreInlineKeyboard());
      }
    };

    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
      if (activeWheel) {
        const currentStep = activeWheel.fields.Step || 0;
        await showWheelStep(currentStep);
      } else {
        // якщо активного нема — починаємо спочатку
        const result = await wheelBalanceService.startWheelBalance(tgId);
        await userService.updateUserStep(tgId, 'WheelBalance');
        if (result?.message && result?.keyboard) {
          try { await ctx.editMessageText(result.message, result.keyboard); } catch {}
          await ctx.reply(result.message, result.keyboard);
        } else {
          await showWheelStep(0);
        }
      }
      await ctx.answerCbQuery('Продовжуємо колесо балансу');
      return;
    }

    if (data === 'wheel_restart' || data === 'wheel_start_new' || data === 'wheel_monthly_start' || data === 'wheel_start') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
      if (activeWheel && (data === 'wheel_continue')) {
        const currentStep = activeWheel.fields.Step || 0;
        await showWheelStep(currentStep);
        await ctx.answerCbQuery('Продовжуємо активне колесо');
        return;
      }

      // стартуємо свіже колесо
      const result = await wheelBalanceService.startWheelBalance(tgId);
      await userService.updateUserStep(tgId, 'WheelBalance');

      // спроба відредагувати "кнопкове" повідомлення (не критично, може впасти)
      try { await ctx.editMessageText('✅ Запускаємо колесо балансу...'); } catch {}

      if (result?.message && result?.keyboard) {
        // надсилаємо НОВЕ повідомлення (це головне)
        await ctx.reply(result.message, result.keyboard);
      } else {
        // фолу-бек: будуємо дефолтне перше питання
        await showWheelStep(0);
      }

      await ctx.answerCbQuery('Колесо балансу розпочато');
      return;
    }

    if (data === 'wheel_cancel' || data === 'wheel_exit') {
      await cancelActiveWheel(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      try { await ctx.editMessageText('🚪 Колесо балансу скасовано'); } catch { await ctx.reply('🚪 Колесо балансу скасовано'); }
      await ctx.answerCbQuery('Колесо балансу скасовано');
      setTimeout(async () => { await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard()); }, 500);
      return;
    }

    if (data === 'wheel_to_menu') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      try { await ctx.editMessageText('🏠 Повертаємося до головного меню'); } catch {}
      await ctx.answerCbQuery('Повернення до меню');
      setTimeout(async () => { await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard()); }, 500);
      return;
    }

    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''), 10);
      if (!Number.isNaN(score) && score >= 0 && score <= 10) {
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
