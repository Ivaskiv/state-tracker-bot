// src/controllers/wheelBalanceController.js - ВИПРАВЛЕНО ЛОГІКУ

import wheelBalanceService from '../services/wheelBalanceService.js';
import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { ANSWER_STEPS, OB_STEPS } from '../config/constants.js';
import path from 'path';

// ———————————————————————————————————————————————
// ДОСТУП: активна підписка або валідний TRIAL (+ "гаряча" сесія після активації)
// ———————————————————————————————————————————————

function hasActiveAccessOrSession(ctx, user) {
  // 1) базова перевірка (включає trial за датою)
  if (userService.hasActiveAccess?.(user)) return true;

  // 2) щойно активований trial в онбордингу — пускаємо
  if (ctx?.session?.trialJustActivated) return true;

  // 3) ми вже в кроках одразу після активації — пускаємо
  const step = ctx?.session?.step;
  if ([OB_STEPS.PAYMENT_SUCCESS, OB_STEPS.REMINDERS_INTRO, OB_STEPS.DONE].includes(step)) return true;

  return false;
}

// ———————————————————————————————————————————————
// "ПОЧАТИ КОЛЕСО" (із меню або callback 'wheel_start')
// ———————————————————————————————————————————————

const handleWheelBalanceRequest = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    console.log(`🎯 [wheelBalanceController] Запит на колесо від ${tgId}`);
    
    const user = await userService.getUserByTelegramId(tgId);

    // ✅ ПЕРЕВІРКА ДОСТУПУ
    if (!hasActiveAccessOrSession(ctx, user)) {
      console.log(`🎯 [wheelBalanceController] ❌ Немає доступу для ${tgId}`);
      await typing(ctx);
      await ctx.reply(
        '🎯 Колесо балансу доступне тільки з активною підпискою.\n\n' +
        'Активуй підписку в меню «💰 Підписка».',
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

    // ✅ ПЕРЕВІРКА АКТИВНОГО КОЛЕСА
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    
    if (activeWheel) {
      console.log(`🎯 [wheelBalanceController] 🔄 Знайдено активне колесо для ${tgId}, Step: ${activeWheel.fields.Step}`);
      
      const currentStep = Number(activeWheel.fields.Step || 0);
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];

      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу.\n\n` +
        `${currentStep + 1}️⃣/8 ${sphereName}\n\n` +
        `⚠️ Поки триває сесія колеса, інші дії та меню заблоковані.\n\n` +
        `Що робимо?`,
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

    // ✅ СТВОРЕННЯ НОВОГО КОЛЕСА
    const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
    
    // ✅ ВСТАНОВЛЮЄМО КРОК У БАЗІ (ВАЖЛИВО ДЛЯ БЛОКУВАННЯ МЕНЮ)
    await userService.updateUserStep(tgId, 'WheelBalance');

    // ✅ НАДСИЛАЄМО ЗОБРАЖЕННЯ + ПОВІДОМЛЕННЯ
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
      
      // Fallback без зображення
      await ctx.reply(start.message, start.keyboard);
      console.log(`🎯 [wheelBalanceController] ✅ Колесо запущено без зображення для ${tgId}`);
    }

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка запуску колеса:', error);
    await typing(ctx);
    await ctx.reply('Виникла помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

// ———————————————————————————————————————————————
// ОБРОБКА ТЕКСТОВИХ ВІДПОВІДЕЙ (НОТАТКИ ПІСЛЯ ОЦІНКИ)
// ———————————————————————————————————————————————

const handleWheelNoteText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = (ctx.message?.text || '').trim();
  
  // Перевіряємо чи чекаємо нотатку для колеса
  if (!ctx.session?.wheel?.awaitingNoteFor && ctx.session?.wheel?.awaitingNoteFor !== 0) {
    return false; // не наша нотатка
  }
  
  if (!text || text.length < 5) {
    await ctx.reply('Додай, будь ласка, ще трішки деталей (2–5 речень) про цю сферу життя.');
    return true; // обробили, але потребуємо більше тексту
  }

  console.log(`🎯 [wheelBalanceController] 📝 Обробка нотатки від ${tgId}: "${text.substring(0, 50)}..."`);

  try {
    const res = await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
    
    if (res.error) {
      await ctx.reply(res.message || 'Помилка збереження нотатки. Спробуй ще раз.');
      return true;
    }
    
    if (res.completed) {
      // Колесо завершено
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.reply(res.message, keyboards.wheelBalanceCompleteKeyboard());
      console.log(`🎯 [wheelBalanceController] ✅ Колесо завершено для ${tgId}`);
    } else {
      // Перехід до наступної сфери
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

// ———————————————————————————————————————————————
// ОБРОБКА ЧИСЛОВИХ ОЦІНОК (0-10)
// ———————————————————————————————————————————————

const handleWheelBalanceAnswer = async (ctx, score) => {
  const tgId = ctx.from.id;
  
  console.log(`🎯 [wheelBalanceController] 📊 Оцінка ${score} від ${tgId}`);

  try {
    // Перевіряємо чи є активне колесо
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

    // Після збереження оцінки ми чекаємо нотатку
    console.log(`🎯 [wheelBalanceController] ✅ Оцінка збережена, чекаємо нотатку для сфери ${res.awaitingNoteFor}`);

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка обробки оцінки:', error);
    await ctx.reply('Виникла помилка. Спробуй ще раз.');
  }
};

// ———————————————————————————————————————————————
// CALLBACK-И КОЛЕСА
// ———————————————————————————————————————————————

const handleWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  try {
    console.log(`🎯 [wheelBalanceController] 📱 Callback: ${data} від ${tgId}`);

    // ✅ ПРОДОВЖИТИ ІСНУЮЧЕ КОЛЕСО
    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);

      if (!activeWheel) {
        console.log(`🎯 [wheelBalanceController] ❌ Активне колесо не знайдено для ${tgId}`);
        // Якщо загубили — стартуємо нове
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

      const message =
        `🎯 КОЛЕСО БАЛАНСУ\n\n` +
        `${step + 1}️⃣/8 ${sphereName}\n\n` +
        `Обери оцінку від 0 до 10:`;

      try {
        await ctx.editMessageText(message, keyboards.wheelScoreInlineKeyboard());
      } catch {
        await ctx.reply(message, keyboards.wheelScoreInlineKeyboard());
      }

      await userService.updateUserStep(tgId, 'WheelBalance');
      await ctx.answerCbQuery('Продовжуємо колесо');
      return;
    }

    // ✅ СТАРТ НОВОГО КОЛЕСА
    if (data === 'wheel_restart' || data === 'wheel_start_new' || data === 'wheel_start') {
      const user = await userService.getUserByTelegramId(tgId);
      const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
      await userService.updateUserStep(tgId, 'WheelBalance');

      try {
        await ctx.editMessageText(start.message, start.keyboard);
      } catch {
        await ctx.reply(start.message, start.keyboard);
      }
      await ctx.answerCbQuery('Колесо перезапущено');
      return;
    }

    // ✅ ВИХІД (СКАСУВАННЯ)
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

    // ✅ ОЦІНКИ З ІНЛАЙН-КНОПОК (0..10)
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

    // ✅ ПОВЕРНЕННЯ ДО МЕНЮ ПО ЗАВЕРШЕННІ
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

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка callback:', error);
    try { 
      await ctx.answerCbQuery('Виникла помилка'); 
    } catch {}
  }
};

// ———————————————————————————————————————————————
// УТИЛІТАРНІ ФУНКЦІЇ
// ———————————————————————————————————————————————

const handleWheelRetryCallback = async (ctx) => {
  await handleWheelCallback(ctx);
};

const checkMonthlyWheelNeed = async (bot) => {
  try {
    const users = await userService.getActiveUsers();
    for (const user of users) {
      const tgId = user['TG_id'];
      const needs = await wheelBalanceService.needsWheelBalance(tgId);
      if (needs) {
        await bot.telegram.sendMessage(
          tgId,
          '🎯 Час оновити колесо балансу!\n\nМинув місяць з останньої оцінки. Поки триває сесія, інші дії будуть заблоковані до завершення.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Пройти колесо балансу', callback_data: 'wheel_start' }],
                [{ text: '🚪 Пізніше', callback_data: 'wheel_exit' }]
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
  handleWheelNoteText,  // ✅ ДОДАНО
  handleWheelCallback,
  handleWheelRetryCallback,
  checkMonthlyWheelNeed
};