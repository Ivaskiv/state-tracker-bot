// src/controllers/wheelBalanceController.js

import wheelBalanceService from '../services/wheelBalanceService.js';
import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { ANSWER_STEPS, OB_STEPS } from '../config/constants.js';

// ———————————————————————————————————————————————
// ДОСТУП: активна підписка або валідний TRIAL (+ “гаряча” сесія після активації)
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
// “ПОЧАТИ КОЛЕСО” (із меню або callback 'wheel_start')
// 1) перевіряємо доступ
// 2) якщо є активне колесо → “ПРОДОВЖИТИ / ВИЙТИ”
// 3) якщо нема → створюємо запис у WheelBalance і показуємо 1/8
// ———————————————————————————————————————————————

const handleWheelBalanceRequest = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const user = await userService.getUserByTelegramId(tgId);

    // доступ
    if (!hasActiveAccessOrSession(ctx, user)) {
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

    await typing(ctx);

    // є активне колесо?
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    if (activeWheel) {
      const currentStep = Number(activeWheel.fields.Step || 0);
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];

      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу.\n\n` +
        `${currentStep + 1}️⃣/8 ${sphereName}\n\n` +
        `Поки триває сесія, інші дії та меню заблоковані. Завершимо сесію?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити', callback_data: 'wheel_continue' }],
              [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]
            ]
          }
        }
      );
      return;
    }

    // якщо активного нема — створюємо новий запис у WheelBalance і показуємо 1/8
    const start = await wheelBalanceService.startWheelBalance(tgId, user?.['User Name']);
    // важливо: ставимо крок, щоб ваш botController блокував меню
    await userService.updateUserStep(tgId, 'WheelBalance');

    await ctx.reply(start.message, start.keyboard);

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка запуску:', error);
    await typing(ctx);
    await ctx.reply('Виникла помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

// ———————————————————————————————————————————————
// CALLBACK-И КОЛЕСА
// ———————————————————————————————————————————————

const handleWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  try {
    console.log(`[wheelBalanceController] 📱 Callback: ${data} від ${tgId}`);

    // Продовжити існуюче колесо
    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);

      if (!activeWheel) {
        // якщо загубили — стартуємо нове
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
        `Обери оцінку:`;

      try {
        await ctx.editMessageText(message, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '0',  callback_data: 'wheel_score_0' },
                { text: '1',  callback_data: 'wheel_score_1' },
                { text: '2',  callback_data: 'wheel_score_2' },
                { text: '3',  callback_data: 'wheel_score_3' },
                { text: '4',  callback_data: 'wheel_score_4' },
                { text: '5',  callback_data: 'wheel_score_5' }
              ],
              [
                { text: '6',  callback_data: 'wheel_score_6' },
                { text: '7',  callback_data: 'wheel_score_7' },
                { text: '8',  callback_data: 'wheel_score_8' },
                { text: '9',  callback_data: 'wheel_score_9' },
                { text: '10', callback_data: 'wheel_score_10' }
              ],
              [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]
            ]
          }
        });
      } catch {
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '0',  callback_data: 'wheel_score_0' },
                { text: '1',  callback_data: 'wheel_score_1' },
                { text: '2',  callback_data: 'wheel_score_2' },
                { text: '3',  callback_data: 'wheel_score_3' },
                { text: '4',  callback_data: 'wheel_score_4' },
                { text: '5',  callback_data: 'wheel_score_5' }
              ],
              [
                { text: '6',  callback_data: 'wheel_score_6' },
                { text: '7',  callback_data: 'wheel_score_7' },
                { text: '8',  callback_data: 'wheel_score_8' },
                { text: '9',  callback_data: 'wheel_score_9' },
                { text: '10', callback_data: 'wheel_score_10' }
              ],
              [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]
            ]
          }
        });
      }

      await userService.updateUserStep(tgId, 'WheelBalance');
      await ctx.answerCbQuery('Продовжуємо колесо');
      return;
    }

    // Старт нового (з тригерів типу “почати знову”)
    if (data === 'wheel_restart' || data === 'wheel_start_new' || data === 'wheel_monthly_start') {
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

    // Вихід (скасування)
    if (data === 'wheel_cancel' || data === 'wheel_exit') {
      await wheelBalanceService.cancelActiveWheel(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

      try {
        await ctx.editMessageText('🚪 Колесо балансу скасовано');
      } catch {
        await ctx.reply('🚪 Колесо балансу скасовано');
      }
      await ctx.answerCbQuery('Сесію завершено');

      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 700);
      return;
    }

    // Оцінки з інлайн-кнопок (0..10)
    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''), 10);
      if (Number.isNaN(score) || score < 0 || score > 10) {
        await ctx.answerCbQuery('Невірна оцінка');
        return;
      }

      // Зберігаємо бал і просимо нотатку (далі текст обробляє bot.on('text', ...) через saveWheelNoteAndGoNext)
      const res = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
      await userService.updateUserStep(tgId, 'WheelBalance');

      if (res.error) {
        await ctx.answerCbQuery(res.message || 'Помилка');
      } else {
        await ctx.answerCbQuery('Оцінка збережена');
      }
      return;
    }

    // Повернення до меню по завершенні
    if (data === 'wheel_to_menu') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      try { await ctx.editMessageText('🏠 Повертаємося до головного меню'); } catch {}
      await ctx.answerCbQuery('Меню');

      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 700);
      return;
    }

  } catch (error) {
    console.error('❌ [wheelBalanceController] Помилка callback:', error);
    try { await ctx.answerCbQuery('Виникла помилка'); } catch {}
  }
};

// синхронізований ретраюзер (на випадок якщо є окремий роутер)
const handleWheelRetryCallback = async (ctx) => {
  await handleWheelCallback(ctx);
};

// утиліта для cron/нагадувань: запропонувати старт за місяць
const checkMonthlyWheelNeed = async (bot) => {
  try {
    const users = await userService.getActiveUsers();
    for (const user of users) {
      const tgId = user['TG_id'];
      // ваша сервісна перевірка
      const needs = await wheelBalanceService.needsWheelBalance(tgId);
      if (needs) {
        await bot.telegram.sendMessage(
          tgId,
          '🎯 Час оновити колесо балансу!\n\nМинув місяць з останньої оцінки. Поки триває сесія, інші дії будуть заблоковані до завершення.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Пройти колесо балансу', callback_data: 'wheel_monthly_start' }],
                [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]
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
  handleWheelRetryCallback,
  checkMonthlyWheelNeed
};
