import onboarding, { 
  handleCallback as onboardingCallback, 
  handleText as onboardingText 
} from '../features/onboarding/index.js';

import dashboard, { 
  handleCallback as dashboardCallback,
  handleText as dashboardText
} from '../features/dashboard/index.js';

import dailySessions from '../features/dailySessions/index.js';
import * as wheelBalance from '../features/wheelBalance/index.js';
import { handleCallback as gamificationCallback } from '../features/gamification/index.js';
import keyboards from '../utils/keyboards.js';

export const initRouter = (bot) => {
  console.log('🎮 [router] Ініціалізація...');

  onboarding(bot);
  dashboard(bot);

  bot.on('callback_query', async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    console.log(`[router/callback] 🎯 Обробка: "${data}"`);
    
    try {
      if (await dashboardCallback(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await onboardingCallback(ctx)) {        
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await handleDailySessionsCallback(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await handleWheelCallback(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await gamificationCallback(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      console.log(`[router/callback] ❓ Невідома команда: ${data}`);
      try { await ctx.answerCbQuery('❓ Невідома команда'); } catch {}
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());

    } catch (error) {
      console.error('[router/callback] ❌ Помилка:', error);
      try { await ctx.answerCbQuery('❌ Помилка'); } catch {}
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard()).catch(() => {});
    }
  });

  bot.on('text', async (ctx, next) => {
    try {
      const text = ctx.message?.text?.trim();
      console.log(`[router/text] 📝 Текст отримано: "${text?.substring(0, 30)}..."`);

      const tgId = ctx.from.id;

      // ✅ 1. WHEEL TEXT — ПЕРЕВІРКА НОТАТКИ
      console.log('[router/text] 🔍 Перевірка Wheel...');
      const awaitingNote = await wheelBalance.isAwaitingNote(tgId);
      
      if (awaitingNote) {
        console.log(`[router/text] ✅ Чекаємо нотатку для сфери ${awaitingNote.step}`);
        
        const result = await wheelBalance.saveWheelNoteAndGoNext(ctx, text);

        if (result.error) {
          await ctx.reply(result.message, keyboards.mainMenuKeyboard());
          return;
        }

        if (result.completed) {
          await ctx.reply(result.message, {
            parse_mode: 'Markdown',
            ...keyboards.mainMenuKeyboard()
          });

          try {
            const rewardsService = (await import('../features/gamification/rewards.js')).default;
            await rewardsService.rewardWheel(tgId, ctx.telegram);
          } catch (rewardError) {
            console.error('[router/text] Помилка нагородження:', rewardError);
          }

          return;
        }

        await ctx.reply(result.message, result.keyboard);
        console.log('[router/text] ✅ Wheel оброблено');
        return;
      }

      console.log('[router/text] ℹ️ Не чекаємо нотатку для Wheel');

      // 2. Dashboard Text
      if (await dashboardText(ctx)) {
        console.log('[router/text] ✅ Dashboard оброблено');
        return;
      }

      // 3. Onboarding Text
      if (await onboardingText(ctx)) {
        console.log('[router/text] ✅ Onboarding оброблено');
        return;
      }

      // 4. Daily Sessions Text
      if (await handleDailySessionsText(ctx)) {
        console.log('[router/text] ✅ Daily Sessions оброблено');
        return;
      }

      console.log('[router/text] ❓ Жоден handler не спрацював');
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());

    } catch (error) {
      console.error('[router/text] ❌ Помилка:', error);
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз або натисни /start', keyboards.mainMenuKeyboard()).catch(() => {});
    }
  });

  console.log('✅ [router] Готовий');
};

const handleDailySessionsCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const dailyCallbacks = [
    'start_morning',
    'start_evening',
    'later_morning',
    'later_evening',
    'exit_session',
    'skip_morning_do_evening'
  ];

  if (!dailyCallbacks.includes(data)) return false;

  const tgId = ctx.from.id;

  try {
    console.log(`[router/daily] 🎯 Обробка: "${data}"`);

    if (data === 'start_morning') {
      await dailySessions.startMorningSession(ctx);
      return true;
    }

    if (data === 'start_evening') {
      await dailySessions.startEveningSession(ctx);
      return true;
    }

    if (data === 'later_morning' || data === 'later_evening') {
      await ctx.reply('✅ Добре! Можеш почати пізніше через меню.', keyboards.mainMenuKeyboard());
      return true;
    }

    if (data === 'exit_session') {
      const user = await (await import('../features/onboarding/handlers.js')).getUserByTgId(tgId);
      const step = user?.fields?.Answer_Step;
      
      const sessionType = step?.includes('Q_m_') ? 'morning' : 'evening';
      
      if (sessionType === 'morning') {
        await dailySessions.exitMorningSession(ctx);
      } else {
        await dailySessions.exitEveningSession(ctx);
      }
      
      return true;
    }

    if (data === 'skip_morning_do_evening') {
      await dailySessions.startEveningSession(ctx);
      return true;
    }

    return false;

  } catch (error) {
    console.error('[router/daily] ❌ Помилка:', error);
    return false;
  }
};

const handleDailySessionsText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (!text) return false;

  try {
    const user = await (await import('../features/onboarding/handlers.js')).getUserByTgId(tgId);
    const step = user?.fields?.Answer_Step;

    if (!step) return false;

    if (step.match(/Q_m_(\d+)/)) {
      const questionNum = parseInt(step.match(/Q_m_(\d+)/)[1], 10);
      await dailySessions.handleMorningAnswer(ctx, text, questionNum);
      return true;
    }

    if (step.match(/Q_e_(\d+)/)) {
      const questionNum = parseInt(step.match(/Q_e_(\d+)/)[1], 10);
      await dailySessions.handleEveningAnswer(ctx, text, questionNum);
      return true;
    }

    return false;

  } catch (error) {
    console.error('[router/daily] ❌ Помилка text:', error);
    return false;
  }
};

const handleWheelCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const wheelCallbacks = [
    'wheel_start', 
    'wheel_continue', 
    'wheel_exit', 
    'skip_first_wheel', 
    'wheel_history',
    'wheel_restart',
    'wheel_restart_confirmed'
  ];
  
  const isWheelCallback = wheelCallbacks.includes(data) || 
                          data.startsWith('wheel_score_') || 
                          data.startsWith('wheel_skip_note_');

  if (!isWheelCallback) return false;

  const tgId = ctx.from.id;

  try {
    console.log(`[router/wheel] 🎯 Обробка: "${data}"`);

    if (data === 'wheel_start') {
      const user = await (await import('../features/onboarding/handlers.js')).getUserByTgId(tgId);
      const userName = user?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';

      const result = await wheelBalance.startWheelBalance(tgId, userName);

      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        return true;
      }

      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    if (data === 'wheel_restart_confirmed') {
      const user = await (await import('../features/onboarding/handlers.js')).getUserByTgId(tgId);
      const userName = user?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';

      const result = await wheelBalance.startNewWheelIgnoreOld(tgId, userName);

      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        return true;
      }

      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    if (data === 'skip_first_wheel') {
      await ctx.reply(
        '✅ Добре! Можеш заповнити колесо пізніше через меню.\n\n💡 Рекомендую пройти його найближчим часом для кращих результатів.',
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    if (data === 'wheel_history') {
      const history = await wheelBalance.getWheelHistory(tgId);
      
      if (!history || history.length === 0) {
        await ctx.reply('📊 У тебе поки немає історії коліс балансу.', keyboards.mainMenuKeyboard());
        return true;
      }

      let message = '📊 **ІСТОРІЯ КОЛІС БАЛАНСУ**\n\n';
      
      history.forEach((wheel, index) => {
        const date = wheel.fields.Created_Date || wheel.fields.Date;
        const avgScore = wheel.fields.Total_Score || 'н/д';
        message += `${index + 1}. ${date} — Загальна оцінка: ${avgScore}/80\n`;
      });

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Пройти нове колесо', callback_data: 'wheel_restart_confirmed' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
      return true;
    }

    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''), 10);
      
      if (isNaN(score) || score < 0 || score > 10) {
        await ctx.reply('❌ Некоректна оцінка', keyboards.mainMenuKeyboard());
        return true;
      }

      await wheelBalance.processWheelAnswer(tgId, score, ctx);
      return true;
    }

    if (data.startsWith('wheel_skip_note_')) {
      const result = await wheelBalance.saveWheelNoteAndGoNext(ctx, 'Без нотатки');
      
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        return true;
      }

      if (result.completed) {
        await ctx.reply(result.message, {
          parse_mode: 'Markdown',
          ...keyboards.mainMenuKeyboard()
        });

        try {
          const rewardsService = (await import('../features/gamification/rewards.js')).default;
          await rewardsService.rewardWheel(tgId, ctx.telegram);
        } catch (rewardError) {
          console.error('[router/wheel] Помилка нагородження:', rewardError);
        }

        return true;
      }

      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    if (data === 'wheel_exit') {
      await wheelBalance.cancelActiveWheel(tgId);
      await ctx.reply('✅ Колесо скасовано. Можеш почати заново будь-коли!', keyboards.mainMenuKeyboard());
      return true;
    }

    if (data === 'wheel_continue') {
      const result = await wheelBalance.continueActiveWheel(tgId, ctx);

      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        return true;
      }

      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    if (data === 'wheel_restart') {
      await ctx.reply(
        '⚠️ Це скасує поточне колесо. Продовжити?',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Так, почати заново', callback_data: 'wheel_restart_confirmed' }],
              [{ text: '❌ Ні, продовжити поточне', callback_data: 'wheel_continue' }]
            ]
          }
        }
      );
      return true;
    }

    return false;

  } catch (error) {
    console.error('[router/wheel] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка обробки колеса. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    return true;
  }
};

console.log('✅ [bot/router] Router завантажено');