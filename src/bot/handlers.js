// src/bot/handlers.js

// src/bot/handlers.js
// Головний реєстратор хендлерів Telegraf під структуру /features/*

import keyboards from '../utils/keyboards.js';
import { typing } from '../utils/typing.js';

// ===== Фічі (експортують handleStart/handleText/handleCallback або подібні) =====
import onboarding from '../features/onboarding/index.js';
import subscription from '../features/subscription/index.js';
import wheel from '../features/wheelBalance/index.js';
import daily from '../features/dailySessions/index.js';
import aiMentor from '../features/aiMentor/index.js';
import reports from '../features/reports/index.js';
import gamification from '../features/gamification/index.js';
import affirmations from '../features/affirmations/index.js';

// Сервіси (можуть не мати всіх методів — обгортаємо в try/catch)
import usersService from '../services/users.js';

// ---------- утиліти ----------
const safeReply = async (ctx, text, extra) => {
  try { await ctx.reply(text, extra); } catch { /* ignore */ }
};

const ensureCreatedAt = async (tgId) => {
  try {
    const user = await usersService.getByTgId?.(tgId);
    if (!user?.id) return;
    const fields = user.fields || user; // підтримка двох форматів
    if (!fields.Created_At) {
      await usersService.update?.(user.id, { Created_At: new Date().toISOString() });
      console.log(`[bot] 🕓 Доставлено Created_At для ${tgId}`);
    }
  } catch (e) {
    console.warn('[bot] ⚠️ Не зміг проставити Created_At:', e?.message || e);
  }
};

// Повертає true, якщо хендлер з’їв апдейт
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

// ---------- основний реєстратор ----------
const registerBotHandlers = (bot) => {
  console.log('🤖 [bot] Ініціалізація...');

  // ===== Глобальне логування апдейтів =====
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

  // ===== /start =====
  bot.start(async (ctx) => {
    try {
      await typing(ctx);
      const handled = await tryHandle(onboarding.handleStart, ctx);
      // страховка на випадок, якщо юзер уже був без Created_At
      await ensureCreatedAt(ctx.from.id);

      if (!handled) {
        await safeReply(ctx, '❌ Помилка запуску. Спробуй ще раз /start', keyboards.mainMenuKeyboard?.());
      }
    } catch (error) {
      console.error('[bot] ❌ /start error:', error);
      await safeReply(ctx, '❌ Помилка запуску. Спробуй ще раз /start');
    }
  });

  // ===== Текстові повідомлення =====
  bot.on('text', async (ctx) => {
    try {
      // 1) Спочатку даємо шанс онбордингу завершитись
      if (await tryHandle(onboarding.handleText, ctx)) return;

      // 2) Денні/вечірні сесії
      if (await tryHandle(daily.handleText, ctx)) return;

      // 3) AI-наставник
      if (await tryHandle(aiMentor.handleText, ctx)) return;

      // 4) Афірмації, гейміфікація, репорти (якщо слухають текст)
      if (await tryHandle(affirmations.handleText, ctx)) return;
      if (await tryHandle(gamification.handleText, ctx)) return;
      if (await tryHandle(reports.handleText, ctx)) return;

      // 5) Фолбек меню
      await safeReply(ctx, '❌ Невідома команда', keyboards.mainMenuKeyboard?.());
    } catch (error) {
      console.error('[bot] ❌ Text handler error:', error);
      await safeReply(ctx, '❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard?.());
    }
  });

  // ===== Callback-кнопки =====
  bot.on('callback_query', async (ctx) => {
    try {
      // Порядок важливий:
      // 1) онбординг (кнопки імені/емейлу/планів/таймзони)
      if (await tryHandle(onboarding.handleCallback, ctx)) return;

      // 2) підписки/оплата/синхронізація
      if (await tryHandle(subscription.handleCallback, ctx)) return;

      // 3) колесо балансу (після реєстрації “перше колесо” — сюди)
      if (await tryHandle(wheel.handleCallback, ctx)) return;

      // 4) щоденні/вечірні
      if (await tryHandle(daily.handleCallback, ctx)) return;

      // 5) AI-ментор
      if (await tryHandle(aiMentor.handleCallback, ctx)) return;

      // 6) інше (аффірмації/гейміфікація/репорти)
      if (await tryHandle(affirmations.handleCallback, ctx)) return;
      if (await tryHandle(gamification.handleCallback, ctx)) return;
      if (await tryHandle(reports.handleCallback, ctx)) return;

      // 7) якщо ніхто не з’їв
      await ctx.answerCbQuery('Невідома дія').catch(() => {});
      await safeReply(ctx, '❓ Невідома дія. Спробуй ще раз', keyboards.mainMenuKeyboard?.());
    } catch (error) {
      console.error('[bot] ❌ Callback error:', error);
      try { await ctx.answerCbQuery('Сталася помилка'); } catch {}
      await safeReply(ctx, '❌ Помилка callback. Спробуй /start', keyboards.mainMenuKeyboard?.());
    }
  });

  // ===== Глобальний catcher =====
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
