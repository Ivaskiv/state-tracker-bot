// src/bot/router.js — ВИПРАВЛЕНА ВЕРСІЯ (з правильною послідовністю)
// ✅ ВИПРАВЛЕНО: Правильна послідовність обробки текстових команд
// ✅ ВИПРАВЛЕНО: Видалено editMessageText (не працює в інлайн-кнопках)
// ✅ ВИПРАВЛЕНО: Додано правильну обробку всіх callback_query

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
import users from '../services/users.js';
import logger from '../utils/logger.js';

// ── Обробка текстових повідомлень ────────────────────────────────────────────
const handleDailySessionsText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  if (!text) return false;

  try {
    const user = await users.getUserByTgId(tgId);
    if (!user) return false;

    const answerStep = user.fields?.Answer_Step;
    if (!answerStep) return false;

    logger.info(`[router/text] Answer_Step: ${answerStep}`);

    // ==========================================
    // ✅ 1. ОНБОРДИНГ (ПЕРШІСТЬ!)
    // ==========================================
    if (answerStep === 'OB_NAME') {
      return await handleText(ctx);
    }
    if (answerStep === 'OB_EMAIL') {
      return await handleText(ctx);
    }
    if (answerStep === 'OB_PHONE') {
      return await handleText(ctx);
    }

    // ==========================================
    // ✅ 2. КОЛЕСО БАЛАНСУ (НОТАТКА)
    // ==========================================
    const awaitingNote = await wheelBalance.isAwaitingNote(tgId);
    if (awaitingNote && awaitingNote !== null && awaitingNote !== undefined) {
      logger.info(`[router/text] 💬 Чекаємо нотатку для колеса`);
      
      const result = await wheelBalance.saveWheelNoteAndGoNext(ctx, text);
      
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        return true;
      }

if (result.completed) {
  await ctx.reply(result.message, { parse_mode: 'Markdown', ...keyboards.mainMenuKeyboard() });
  return true;
}
      await ctx.reply(result.message, result.keyboard);
      return true;
    }

    // ==========================================
    // ✅ 3. ЩОДЕННІ СЕСІЇ (РАНОК/ВЕЧІР)
    // ==========================================
    const morningMatch = answerStep?.match(/Q_m_(\d+)/i);
    const eveningMatch = answerStep?.match(/Q_e_(\d+)/i);

    if (morningMatch) {
      const questionNum = parseInt(morningMatch[1], 10);
      logger.info(`[router/text] 🌞 Ранкове питання ${questionNum}`);
      await dailySessions.handleMorningAnswer(ctx, text, questionNum);
      return true;
    }

    if (eveningMatch) {
      const questionNum = parseInt(eveningMatch[1], 10);
      logger.info(`[router/text] 🌙 Вечірне питання ${questionNum}`);
      await dailySessions.handleEveningAnswer(ctx, text, questionNum);
      return true;
    }

    // ==========================================
    // ✅ 4. AI НАСТАВНИК
    // ==========================================
    if (answerStep === 'ai_mentor_active') {
      logger.info(`[router/text] 🤖 AI Mentor запит`);
      if (await aiMentorModule.handleText?.(ctx)) {
        return true;
      }
    }

    logger.warn(`[router/text] ❓ Невідомий Answer_Step: ${answerStep}`);
    return false;

  } catch (error) {
    logger.error('[router/text] ❌ Помилка:', error);
    return false;
  }
};

// ── Обробка callback_query (кнопки) ──────────────────────────────────────────
const handleDailySessionsCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const dailyCallbacks = [
    'start_morning', 'start_evening', 'later_morning', 'later_evening',
    'exit_session', 'skip_morning_do_evening', 'restart_morning', 'restart_evening'
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

    if (data === 'restart_morning') {
      await dailySessions.restartMorningSession(ctx);
      return true;
    }

    if (data === 'restart_evening') {
      await dailySessions.restartEveningSession(ctx);
      return true;
    }

    if (data === 'exit_session') {
      const user = await users.getUserByTgId(tgId);
      const step = user?.fields?.Answer_Step || '';
      const sessionType = step.includes('Q_m_') ? 'morning' : 'evening';
      
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
if (data.startsWith('wheel_skip_note_')) {
  logger.info(`[router/wheel] ⏭️ Пропуск нотатки: ${data}`);
  const result = await wheelBalance.saveWheelNoteAndGoNext(ctx, 'Без нотатки');
  logger.info(`[router/wheel] 📊 Результат: error=${result.error}, completed=${result.completed}`);
  
  if (result.error) {
    logger.error(`[router/wheel] ❌ Помилка: ${result.message}`);
    await ctx.reply(result.message, keyboards.mainMenuKeyboard());
  } else if (result.completed) {
    logger.info(`[router/wheel] ✅ Колесо завершено!`);
    await ctx.reply(result.message, { parse_mode: 'Markdown', ...keyboards.mainMenuKeyboard() });
  } else {
    logger.info(`[router/wheel] ➡️ Наступний крок`);
    await ctx.reply(result.message, result.keyboard);
  }
  return true;
}

if (data === 'wheel_go_back') {
  logger.info(`[router/wheel] ⬅️ Повернення назад`);
  const result = await wheelBalance.goBackWheelStep(tgId, ctx);
  logger.info(`[router/wheel] 📊 Результат goBackWheelStep: ${JSON.stringify(result)}`);
  try { await ctx.answerCbQuery('⬅️ Повертаємось назад'); } catch {}
  return true;
}
    return false;
  } catch (error) {
    logger.error('[router/daily] ❌ Помилка:', error);
    return false;
  }
};

// ── Обробка Wheel callback'ів ────────────────────────────────────────────────
const handleWheelCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  const wheelCallbacks = [
    'wheel_start', 'wheel_continue', 'wheel_exit', 'skip_first_wheel', 
    'wheel_history', 'wheel_restart', 'wheel_restart_confirmed', 'wheel_view_analysis',
    'wheel_go_back'
  ];
  
  const isWheelCallback = wheelCallbacks.some(cb => data === cb) || 
                          data.startsWith('wheel_score_') ||
                          data.startsWith('wheel_skip_note_');  

  if (!isWheelCallback) return false;

  const tgId = ctx.from.id;

  try {
    logger.info(`[router/wheel] 🎯 Обробка: "${data}"`);
if (data === 'main_menu') {
  logger.info(`[router]`);
  await dashboardModule.showMainMenu?.(ctx);
  try { await ctx.answerCbQuery(); } catch {}
  return;
}

    if (data === 'wheel_start') {
      const user = await users.getUserByTgId(tgId);
      const userName = user?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';
      const result = await wheelBalance.startWheelBalance(tgId, userName);
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      } else {
        await ctx.reply(result.message, result.keyboard);
      }
      return true;
    }

if (data === 'wheel_restart_confirmed') {
  const user = await users.getUserByTgId(tgId);
  const userName = user?.fields?.['User Name'] || ctx.from.first_name || 'Користувач';
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
    // ✅ Нагородження вже відбулось у flow.js
    await ctx.reply(result.message, { parse_mode: 'Markdown', ...keyboards.mainMenuKeyboard() });
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
      const LIFE_SPHERES = (await import('../config/constantsWheel.js')).LIFE_SPHERES;
      if (step <= LIFE_SPHERES.length) {
        const sphere = LIFE_SPHERES[step - 1];
        await ctx.reply(
          `🎯 КОЛЕСО БАЛАНСУ**\n\n📍 Сфера ${step}/${LIFE_SPHERES.length}: **${sphere.label}\n\n${sphere.description}\n\nОціни від 0 до 10:`,
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
      await wheelBalance.cancelWheelBalance(tgId);
      await ctx.reply('✅ Колесо скасовано. Можеш почати заново будь-коли!', keyboards.mainMenuKeyboard());
      return true;
    }

    if (data === 'wheel_go_back') {
      await wheelBalance.goBackWheelStep(tgId, ctx);
      try { await ctx.answerCbQuery('⬅️ Повертаємось назад'); } catch {}
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
          ]
        }
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('[router/wheel] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка обробки колеса. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    return true;
  }
};

// ── Ініціалізація роутера ────────────────────────────────────────────────────
export const initRouter = (bot) => {
  logger.info('🎮 [router] Ініціалізація…');

  // /start команда
  bot.start(async (ctx) => {
    try {
      logger.info('[router] /start від користувача:', ctx.from.id);
      await handleStart(ctx);
    } catch (error) {
      logger.error('[router/start] ❌ Помилка:', error);
      await ctx.reply('❌ Сталася помилка. Спробуй /start ще раз.');
    }
  });

  // ── Текстові повідомлення ────────────────────────────────────────────────
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message?.text?.trim();
      logger.info(`[router/text] 📝 Текст: "${text?.substring(0, 50)}..."`);

      // Послідовність обробки:
      // 1. Онбординг → 2. Колесо (нотатка) → 3. Щоденні сесії → 4. AI → 5. Меню
      
      if (await handleDailySessionsText(ctx)) return;
      if (await dashboardModule.handleText?.(ctx)) return;
      if (await aiMentorModule.handleText?.(ctx)) return;

      logger.warn('[router/text] ❓ Жоден handler не спрацював');
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());
    } catch (error) {
      logger.error('[router/text] ❌ Помилка:', error);
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз або натисни /start', keyboards.mainMenuKeyboard());
    }
  });

  // ── Callback query (кнопки) ──────────────────────────────────────────────
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data;
    try {
      logger.info(`[router/callback] 🎯 Обробка: "${data}"`);
  if (data === 'main_menu') {
  logger.info(`[router] 🏠 main_menu натиснуто`);
  try { 
    await ctx.answerCbQuery('Меню вже активне'); 
  } catch {}
  return;
    }
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

      logger.warn(`[router/callback] ❓ Невідома команда: ${data}`);
      try { await ctx.answerCbQuery('❓ Невідома команда'); } catch {}
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());
    } catch (error) {
      logger.error('[router/callback] ❌ Помилка:', error);
      try { await ctx.answerCbQuery('❌ Помилка'); } catch {}
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    }
  });

  logger.info('✅ [router] Готовий');
};

console.log('✅ [bot/router] Router завантажено');