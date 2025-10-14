// src/bot/router.js

import onboarding, { 
  handleCallback as onboardingCallback, 
  handleText as onboardingText 
} from '../features/onboarding/index.js';

import dashboard, { 
  handleCallback as dashboardCallback,
  handleText as dashboardText
} from '../features/dashboard/index.js';

import dailySessions from '../features/dailySessions/index.js';

// ✅ ІМПОРТ WHEEL BALANCE
import * as wheelBalance from '../features/wheelBalance/index.js';

import { handleCallback as gamificationCallback } from '../features/gamification/index.js';
import keyboards from '../utils/keyboards.js';

export const initRouter = (bot) => {
  console.log('🎮 [router] Ініціалізація...');

  // ===== МОДУЛІ =====
  onboarding(bot);
  dashboard(bot);

  // ===== CALLBACK HANDLERS =====
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

      // ✅ WHEEL BALANCE
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
      await ctx.reply(
        '❓ Невідома команда. Використай меню нижче.',
        keyboards.mainMenuKeyboard()
      );

    } catch (error) {
      console.error('[router/callback] ❌ Помилка:', error);
      try { await ctx.answerCbQuery('❌ Помилка'); } catch {}
      await ctx.reply(
        '❌ Виникла помилка. Спробуй ще раз.',
        keyboards.mainMenuKeyboard()
      ).catch(() => {});
    }
  });

  // ===== TEXT HANDLERS =====
  bot.on('text', async (ctx, next) => {
    try {
      if (await dashboardText(ctx)) return;
      if (await onboardingText(ctx)) return;
      if (await handleDailySessionsText(ctx)) return;
      if (await handleWheelText(ctx)) return;

      await ctx.reply(
        '❓ Невідома команда. Використай меню нижче.',
        keyboards.mainMenuKeyboard()
      );

    } catch (error) {
      console.error('[router/text] ❌ Помилка:', error);
      await ctx.reply(
        '❌ Виникла помилка. Спробуй ще раз або натисни /start',
        keyboards.mainMenuKeyboard()
      ).catch(() => {});
    }
  });

  console.log('✅ [router] Готовий');
};

// ═══════════════════════════════════════════════════════════════
// DAILY SESSIONS HANDLERS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// WHEEL BALANCE HANDLERS
// ═══════════════════════════════════════════════════════════════

const handleWheelCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const wheelCallbacks = ['wheel_start', 'wheel_continue', 'wheel_exit', 'skip_first_wheel', 'wheel_history'];
  const isWheelCallback = wheelCallbacks.includes(data) || data.startsWith('wheel_score_');

  if (!isWheelCallback) return false;

  const tgId = ctx.from.id;

  try {
    console.log(`[router/wheel] 🎯 Обробка: "${data}"`);

    if (data === 'wheel_start') {
      const user = await (await import('../features/onboarding/handlers.js')).getUserByTgId(tgId);
      const userName = user?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';

      const result = await wheelBalance.startWheelBalance(tgId, userName);

      if (result.error) {
        await ctx.reply(result.message);
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

    // ✅ ІСТОРІЯ КОЛІС
    if (data === 'wheel_history') {
      const history = await wheelBalance.getWheelHistory(tgId);
      
      if (!history || history.length === 0) {
        await ctx.reply('📊 У тебе поки немає історії коліс балансу.');
        return true;
      }

      let message = '📊 **ІСТОРІЯ КОЛІС БАЛАНСУ**\n\n';
      
      history.forEach((wheel, index) => {
        const date = wheel.fields.Created_Date || wheel.fields.Date;
        const avgScore = wheel.fields.Average_Score || 'н/д';
        message += `${index + 1}. ${date} — Середній: ${avgScore}/10\n`;
      });

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Пройти нове колесо', callback_data: 'wheel_start' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
      return true;
    }

    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''), 10);
      
      if (isNaN(score) || score < 0 || score > 10) {
        await ctx.reply('❌ Некоректна оцінка');
        return true;
      }

      const result = await wheelBalance.processWheelAnswer(tgId, score, ctx);

      if (result.error) {
        await ctx.reply(result.message);
      }

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
        await ctx.reply(result.message);
        return true;
      }

      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    return false;

  } catch (error) {
    console.error('[router/wheel] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка обробки колеса. Спробуй ще раз.');
    return true;
  }
};

const handleWheelText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (!text) return false;

  try {
    const awaitingNote = await wheelBalance.isAwaitingNote(tgId);

    if (!awaitingNote) return false;

    console.log(`[router/wheel] 📝 Збереження нотатки для сфери ${awaitingNote.step}`);

    const result = await wheelBalance.saveWheelNoteAndGoNext(ctx, text);

    if (result.error) {
      await ctx.reply(result.message);
      return true;
    }

    if (result.completed) {
      await ctx.reply(result.message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🏠 До меню', callback_data: 'main_menu' }]]
        }
      });

      try {
        const rewardsService = (await import('../features/gamification/rewards.js')).default;
        await rewardsService.rewardWheel(tgId, ctx.telegram);
      } catch (rewardError) {
        console.error('[router/wheel] Помилка нагородження:', rewardError);
      }

      if (result.isFirstWheel) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await ctx.reply(
          '🎉 **ВІТАЮ З ПЕРШИМ КОЛЕСОМ!**\n\n' +
          '📋 Тепер ти можеш:\n' +
          '• 🌞 Проходити ранкові рефлексії\n' +
          '• 🌙 Проходити вечірні рефлексії\n' +
          '• 🤖 Спілкуватись з AI-наставником\n' +
          '• 📊 Переглядати звіти\n\n' +
          '⏰ **Нагадування:**\n' +
          '• Ранкові питання — щодня о 12:58\n' +
          '• Вечірні питання — щодня о 15:00\n\n' +
          '💡 Або можеш почати зараз через меню внизу!',
          {
            parse_mode: 'Markdown',
            ...keyboards.mainMenuKeyboard()
          }
        );
      }

      return true;
    }

    await ctx.reply(result.message, result.keyboard);
    return true;

  } catch (error) {
    console.error('[router/wheel] ❌ Помилка text handler:', error);
    return false;
  }
};

console.log('✅ [bot/router] Router завантажено');