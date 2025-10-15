// src/bot/handlers.js

import keyboards from '../utils/keyboards.js';
import { typing } from '../utils/typing.js';

// ===== Фічі =====
import onboarding from '../features/onboarding/index.js';
import subscription from '../features/subscription/index.js';
import wheel from '../features/wheelBalance/index.js';
import daily from '../features/dailySessions/index.js';
import aiMentor from '../features/aiMentor/index.js';
import reports from '../features/reports/index.js';
import gamification from '../features/gamification/index.js';
import affirmations from '../features/affirmations/index.js';

// Сервіси
import usersService from '../services/user.js';

const safeReply = async (ctx, text, extra) => {
  try { await ctx.reply(text, extra); } catch { /* ignore */ }
};

const ensureCreatedAt = async (tgId) => {
  try {
    const user = await usersService.getByTgId?.(tgId);
    if (!user?.id) return;
    const fields = user.fields || user;
    if (!fields.Created_At) {
      await usersService.update?.(user.id, { Created_At: new Date().toISOString() });
      console.log(`[bot] 🕓 Доставлено Created_At для ${tgId}`);
    }
  } catch (e) {
    console.warn('[bot] ⚠️ Не зміг проставити Created_At:', e?.message || e);
  }
};

const tryHandle = async (fn, ctx, ...args) => {
  if (typeof fn !== 'function') return false;
  try {
    const res = await fn(ctx, ...args);
    return !!res;
  } catch (e) {
    console.error('[bot] ❌ Handler fail:', e?.message || e);
    return false;
  }
};

// ✅ ДОДАНО: handleWheelText
const handleWheelText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (!text) return false;

  try {
    console.log('[bot/wheel-text] 🔍 Перевірка чи чекаємо нотатку...');

    const awaitingNote = await wheel.isAwaitingNote(tgId);

    if (!awaitingNote) {
      console.log('[bot/wheel-text] ℹ️ Не чекаємо нотатку');
      return false;
    }

    console.log(`[bot/wheel-text] ✅ Чекаємо нотатку для сфери ${awaitingNote.step}`);

    const result = await wheel.saveWheelNoteAndGoNext(ctx, text);

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
        console.error('[bot/wheel-text] Помилка нагородження:', rewardError);
      }

      return true;
    }

    await ctx.reply(result.message, result.keyboard);
    console.log('[bot/wheel-text] ✅ Нотатку збережено');
    return true;

  } catch (error) {
    console.error('[bot/wheel-text] ❌ Помилка:', error);
    return false;
  }
};

const registerBotHandlers = (bot) => {
  console.log('🤖 [bot] Ініціалізація...');

  bot.use(async (ctx, next) => {
    const t = ctx.updateType;
    const from = ctx.from?.id;
    const data = ctx.callbackQuery?.data;
    if (t === 'callback_query') {
      console.log(`➡️ ${t} від ${from} data="${data}"`);
    } else if (t === 'message') {
      const preview = (ctx.message?.text || '').slice(0, 80);
      console.log(`➡️ message від ${from} "${preview}"`);
    } else {
      console.log(`➡️ ${t} від ${from}`);
    }

    try {
      await next();
    } catch (err) {
      console.error('💥 [bot] Middleware error:', err);
      try { await ctx.reply('❌ Сталася помилка. Спробуй /start', keyboards.mainMenuKeyboard?.()); } catch {}
    }
  });

  bot.start(async (ctx) => {
    try {
      await typing(ctx);
      const handled = await tryHandle(onboarding.handleStart, ctx);
      await ensureCreatedAt(ctx.from.id);

      if (!handled) {
        await safeReply(ctx, '❌ Помилка запуску. Спробуй ще раз /start', keyboards.mainMenuKeyboard?.());
      }
    } catch (error) {
      console.error('[bot] ❌ /start error:', error);
      await safeReply(ctx, '❌ Помилка запуску. Спробуй ще раз /start');
    }
  });

  bot.on('text', async (ctx, next) => {
    try {
      console.log('[bot/text] 📝 Обробка тексту...');

      // ✅ 1. Wheel Balance Text (нотатки) - ПЕРШИЙ
      if (await handleWheelText(ctx)) {
        console.log('[bot/text] ✅ Wheel оброблено');
        return;
      }

      // 2. Onboarding Text
      if (await tryHandle(onboarding.handleText, ctx)) {
        console.log('[bot/text] ✅ Onboarding оброблено');
        return;
      }

      // 3. Daily Sessions Text
      if (await tryHandle(daily.handleText, ctx)) {
        console.log('[bot/text] ✅ Daily Sessions оброблено');
        return;
      }

      // 4. AI Mentor Text
      if (await tryHandle(aiMentor.handleText, ctx)) {
        console.log('[bot/text] ✅ AI Mentor оброблено');
        return;
      }

      console.log('[bot/text] ❓ Жоден handler не спрацював');
      await ctx.reply('❓ Невідома команда. Використай меню нижче.', keyboards.mainMenuKeyboard());

    } catch (error) {
      console.error('[bot/text] ❌ Помилка:', error);
      await ctx.reply('❌ Виникла помилка. Спробуй ще раз або натисни /start', keyboards.mainMenuKeyboard()).catch(() => {});
    }
  });

  bot.on('callback_query', async (ctx) => {
    try {
      if (await tryHandle(onboarding.handleCallback, ctx)) return;
      if (await tryHandle(subscription.handleCallback, ctx)) return;
      if (await tryHandle(wheel.handleCallback, ctx)) return;
      if (await tryHandle(daily.handleCallback, ctx)) return;
      if (await tryHandle(aiMentor.handleCallback, ctx)) return;
      if (await tryHandle(affirmations.handleCallback, ctx)) return;
      if (await tryHandle(gamification.handleCallback, ctx)) return;
      if (await tryHandle(reports.handleCallback, ctx)) return;

      await ctx.answerCbQuery('Невідома дія').catch(() => {});
      await safeReply(ctx, '❓ Невідома дія. Спробуй ще раз', keyboards.mainMenuKeyboard?.());
    } catch (error) {
      console.error('[bot] ❌ Callback error:', error);
      try { await ctx.answerCbQuery('Сталася помилка'); } catch {}
      await safeReply(ctx, '❌ Помилка callback. Спробуй /start', keyboards.mainMenuKeyboard?.());
    }
  });

  bot.catch(async (err, ctx) => {
    console.error('❌ [bot] Global error:', err);
    if (ctx?.reply) {
      try { await ctx.reply('❌ Сталася помилка. Спробуй /start', keyboards.mainMenuKeyboard?.()); } catch {}
    }
  });

  console.log('✅ [bot] Хендлери підключено');
  return bot;
};

export default registerBotHandlers;