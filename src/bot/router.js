// src/bot/router.js — ВИПРАВЛЕНА ВЕРСІЯ

import { handleStart, handleCallback, handleText } from '../features/onboarding/handlers.js';
import * as dashboardModule from '../features/dashboard/index.js';
import * as dailySessions from '../features/dailySessions/index.js';
import * as wheelBalance from '../features/wheelBalance/index.js';
import * as gamificationModule from '../features/gamification/index.js';
import * as affirmationsModule from '../features/affirmations/index.js';
import * as reportsModule from '../features/reports/index.js';
import * as aiMentorModule from '../features/aiMentor/index.js';
import * as subscriptionModule from '../features/subscription/index.js';
import keyboards from '../utils/keyboards.js';

// ── Обробка текстових повідомлень ────────────────────────────────────────────
const handleDailySessionsText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  if (!text) return false;

  try {
    // ✅ 0. ПЕРЕВІРКА: Чи користувач в активному колесі? (ЯК ПЕРША ПЕРЕВІРКА)
    const activeWheel = await wheelBalance.getActiveWheel(tgId);
    if (activeWheel) {
      // Користувач має активне колесо, але натиснув текст замість оцінки
      const step = activeWheel.fields.Step || 1;
      const LIFE_SPHERES_IMPORT = (await import('../../config/index.js')).LIFE_SPHERES;
      const sphere = LIFE_SPHERES_IMPORT[step - 1];

      await ctx.reply(
        `❌ Оберіть оцінку від 0 до 10 за допомогою кнопок 👇\n\n` +
        `📍 Сфера ${step}/8: *${sphere.label}*\n\n` +
        `${sphere.description}\n\n` +
        `Оціни від 0 до 10:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboards.wheelScoreKeyboard().reply_markup
        }
      );
      return true; // ✅ Обробили
    }

    // 1. WHEEL TEXT (нотатки) — ПЕРШИЙ
    const awaitingNote = await wheelBalance.isAwaitingNote(tgId);
    if (awaitingNote !== null && awaitingNote !== undefined) {
      const result = await wheelBalance.saveWheelNoteAndGoNext(ctx, text);
      
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        return true;
      }

      if (result.completed) {
        await ctx.reply(result.message, { parse_mode: 'Markdown', ...keyboards.mainMenuKeyboard() });
        try {
          const rewardsService = (await import('../gamification/rewards.js')).default;
          await rewardsService.rewardWheel(tgId, ctx.telegram);
        } catch (e) {
          console.error('[router/wheel-text] Нагородження:', e);
        }
        return true;
      }

      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    // 2. Onboarding Text
    if (await handleText(ctx)) return true;

    // 3. Daily Sessions Text
    const user = (await import('../services/users.js')).default;
    const userData = await user.getUserByTgId(tgId);
    const step = userData?.fields?.Answer_Step;

    if (!step) return false;

    if (step.match(/Q_m_(\d+)/i)) {
      const questionNum = parseInt(step.match(/Q_m_(\d+)/i)[1], 10);
      await dailySessions.handleMorningAnswer(ctx, text, questionNum);
      return true;
    }

    if (step.match(/Q_e_(\d+)/i)) {
      const questionNum = parseInt(step.match(/Q_e_(\d+)/i)[1], 10);
      await dailySessions.handleEveningAnswer(ctx, text, questionNum);
      return true;
    }

    // 4. AI Mentor Text
    if (await aiMentorModule.handleText?.(ctx)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('[router/text] ❌ Помилка:', error);
    return false;
  }
};

// ── Обробка callback_query (кнопки) ──────────────────────────────────────────
const handleDailySessionsCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const dailyCallbacks = [
    'start_morning', 'start_evening', 'later_morning', 'later_evening',
    'exit_session', 'skip_morning_do_evening'
  ];

  if (!dailyCallbacks.includes(data)) return false;

  const tgId = ctx.from.id;

  try {
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
      const user = (await import('../services/users.js')).default;
      const userData = await user.getUserByTgId(tgId);
      const step = userData?.fields?.Answer_Step;
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

// ── Обробка Wheel callback'ів ────────────────────────────────────────────────
const handleWheelCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const wheelCallbacks = [
    'wheel_start', 'wheel_continue', 'wheel_exit', 'skip_first_wheel', 
    'wheel_history', 'wheel_restart', 'wheel_restart_confirmed', 'wheel_view_analysis'
  ];
  
  const isWheelCallback = wheelCallbacks.includes(data) || 
                          data.startsWith('wheel_score_') || 
                          data.startsWith('wheel_skip_note_');

  if (!isWheelCallback) return false;

  const tgId = ctx.from.id;

  try {
    console.log(`[router/wheel] 🎯 Обробка: "${data}"`);

    if (data === 'wheel_start') {
      const user = (await import('../services/users.js')).default;
      const userData = await user.getUserByTgId(tgId);
      const userName = userData?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';
      const result = await wheelBalance.startWheelBalance(tgId, userName);
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      } else {
        await ctx.reply(result.message, result.keyboard);
      }
      return true;
    }

    if (data === 'wheel_restart_confirmed') {
      const user = (await import('../services/users.js')).default;
      const userData = await user.getUserByTgId(tgId);
      const userName = userData?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';
      const result = await wheelBalance.startNewWheelIgnoreOld(tgId, userName);
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      } else {
        await ctx.reply(result.message, result.keyboard);
      }
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
      } else if (result.completed) {
        await ctx.reply(result.message, { parse_mode: 'Markdown', ...keyboards.mainMenuKeyboard() });
        try {
          const rewardsService = (await import('../features/gamification/rewards.js')).default;
          await rewardsService.rewardWheel(tgId, ctx.telegram);
        } catch (e) {
          console.error('[router/wheel] Нагородження:', e);
        }
      } else {
        await ctx.reply(result.message, result.keyboard);
      }
      return true;
    }

    if (data === 'wheel_continue') {
      const activeWheel = await wheelBalance.getActiveWheel(tgId);
      if (!activeWheel) {
        await ctx.reply('❌ Немає активного колеса', keyboards.mainMenuKeyboard());
        return true;
      }
      const step = activeWheel.fields.Step || 1;
      const spheres = (await import('../config/index.js')).LIFE_SPHERES;
      if (step <= spheres.length) {
        const sphere = spheres[step - 1];
        await ctx.reply(
          `🎯 **КОЛЕСО БАЛАНСУ**\n\n📍 Сфера ${step}/8: **${sphere.label}**\n\n${sphere.description}\n\nОціни від 0 до 10:`,
          keyboards.wheelScoreKeyboard()
        );
      }
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

    if (data === 'wheel_exit') {
      await wheelBalance.cancelActiveWheel(tgId);
      await ctx.reply('✅ Колесо скасовано. Можеш почати заново будь-коли!', keyboards.mainMenuKeyboard());
      return true;
    }

    if (data === 'wheel_view_analysis') {
      const history = await wheelBalance.getWheelHistory(tgId);
      if (!history || history.length === 0) {
        await ctx.reply('📊 Поки немає завершених коліс для аналізу.', keyboards.mainMenuKeyboard());
        return true;
      }
      const last = history[0];
      const f = last.fields || {};
      const date = f.Created_Date || f.Date || 'н/д';
      const total = f.Total_Score ?? f.Total ?? f.Score ?? 'н/д';
      const msg = `📊 *Останній аналіз колеса*\n\n🗓 Дата: *${date}*\n⭐ Загальна оцінка: *${total}*/80\n\nℹ️ Повну історію можна переглянути у «Історія коліс».`;
      await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Історія коліс', callback_data: 'wheel_history' }],
            [{ text: '🔁 Пройти ще раз', callback_data: 'wheel_restart' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[router/wheel] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка обробки колеса. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    return true;
  }
};

// ── Ініціалізація роутера ────────────────────────────────────────────────────
export const initRouter = (bot) => {
  console.log('🎮 [router] Ініціалізація…');

  // /start команда зареєстрована ТІЛЬКИ ТУТ, НЕ в handleStart!
  // Це запобігає дублюванню обробників
  bot.start(async (ctx) => {
    try {
      console.log('[router] /start від користувача:', ctx.from.id);
      await handleStart(ctx);
    } catch (error) {
      console.error('[router/start] ❌ Помилка:', error);
      await ctx.reply('❌ Сталася помилка. Спробуй /start ще раз.');
    }
  });

  // ── Текстові повідомлення ────────────────────────────────────────────────
  bot.on('text', async (ctx, next) => {
    try {
      const text = ctx.message?.text?.trim();
      console.log(`[router/text] 📝 Текст: "${text?.substring(0, 30)}..."`);

      if (await handleDailySessionsText(ctx)) return;
      if (await dashboardModule.handleText?.(ctx)) return;
      if (await handleText(ctx)) return;
      if (await aiMentorModule.handleText?.(ctx)) return;

      console.log('[router/text] ❓ Жоден handler не спрацював');
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());
    } catch (error) {
      console.error('[router/text] ❌ Помилка:', error);
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз або натисни /start', keyboards.mainMenuKeyboard());
    }
  });

  // ── Callback query (кнопки) ──────────────────────────────────────────────
  bot.on('callback_query', async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    try {
      console.log(`[router/callback] 🎯 Обробка: "${data}"`);

      if (await dashboardModule.handleCallback?.(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await handleCallback(ctx)) {
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

      if (await gamificationModule.handleCallback?.(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await affirmationsModule.handleCallback?.(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await reportsModule.handleCallback?.(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await aiMentorModule.handleCallback?.(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      if (await subscriptionModule.handleCallback?.(ctx)) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      console.log(`[router/callback] ❓ Невідома команда: ${data}`);
      try { await ctx.answerCbQuery('❓ Невідома команда'); } catch {}
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());
    } catch (error) {
      console.error('[router/callback] ❌ Помилка:', error);
      try { await ctx.answerCbQuery('❌ Помилка'); } catch {}
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    }
  });
bot.action(/wheel_score_(\d+)/, async (ctx) => {
  const score = parseInt(ctx.match[1]);
  await wheelBalance.processWheelAnswer(ctx.from.id, score, ctx);
});
  console.log('✅ [router] Готовий');
};

console.log('✅ [bot/router] Router завантажено');