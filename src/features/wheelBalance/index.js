// src/features/wheelBalance/index.js

import * as flow from './flow.js';
import logger from '../../utils/logger.js';
import keyboards from '../../utils/keyboards.js';

/**
 * MAIN INIT FUNCTION — регіструє ВСІ хендлери для Wheel Balance
 */
export default function initWheelBalance(bot) {
  console.log('🎯 [wheelBalance] Ініціалізація модуля…');

  // ═══════════════════════════════════════════════════════════
  // 🎡 СТАРТ КОЛЕСА
  // ═══════════════════════════════════════════════════════════

  bot.action('wheel_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const result = await flow.startWheelBalance(ctx.from.id, ctx.from.first_name);
      
      if (result.error) {
        await ctx.reply(result.message, result.keyboard || keyboards.mainMenuKeyboard());
      } else {
        await ctx.reply(result.message, result.keyboard || keyboards.wheelScoreKeyboard());
      }
    } catch (e) {
      logger.error('[wheel/start] ❌', e.message);
      await ctx.reply('❌ Помилка запуску колеса', keyboards.mainMenuKeyboard());
    }
  });

  // ─────────────────────────────────────────────────────────

  // 📊 ОЦІНКА (0-10)
  // ─────────────────────────────────────────────────────────

  bot.action(/wheel_score_(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const score = parseInt(ctx.match[1], 10);
      const result = await flow.processWheelAnswer(ctx.from.id, score, ctx);
      
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      } else {
        await ctx.reply(result.message, keyboards.wheelNoteKeyboard(1));
      }
    } catch (e) {
      logger.error('[wheel/score] ❌', e.message);
      await ctx.reply('❌ Помилка при збереженні оцінки', keyboards.mainMenuKeyboard());
    }
  });

  // ─────────────────────────────────────────────────────────

  // 🗒️ НОТАТКА І ПЕРЕХІД
  // ─────────────────────────────────────────────────────────

  bot.action(/wheel_skip_note_(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const result = await flow.saveWheelNoteAndGoNext(ctx, null);
      
      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      } else if (result.completed) {
        // Колесо завершено
        await ctx.reply(result.message, keyboards.wheelCompletedKeyboard());
      } else {
        // Перехід до наступної сфери
        await ctx.reply(result.message, keyboards.wheelScoreKeyboard());
      }
    } catch (e) {
      logger.error('[wheel/skip_note] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // ⬅️ ПОВЕРНЕННЯ НАЗАД
  // ─────────────────────────────────────────────────────────

  bot.action('wheel_go_back', async (ctx) => {
    try {
      await flow.goBackWheelStep(ctx.from.id, ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[wheel/back] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // 🔄 ПЕРЕЗАПУСК КОЛЕСА
  // ─────────────────────────────────────────────────────────

  bot.action('wheel_restart', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const result = await flow.startNewWheelIgnoreOld(
        ctx.from.id,
        ctx.from.first_name,
        true // forceRestart
      );
      
      await ctx.reply(result.message, result.keyboard || keyboards.wheelScoreKeyboard());
    } catch (e) {
      logger.error('[wheel/restart] ❌', e.message);
    }
  });

  bot.action('wheel_restart_confirmed', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const result = await flow.startNewWheelIgnoreOld(
        ctx.from.id,
        ctx.from.first_name,
        true
      );
      
      await ctx.reply(result.message, result.keyboard || keyboards.wheelScoreKeyboard());
    } catch (e) {
      logger.error('[wheel/restart_confirmed] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // 🚪 ВИХІД ІЗ КОЛЕСА
  // ─────────────────────────────────────────────────────────

  bot.action('wheel_exit', async (ctx) => {
    try {
      await flow.cancelWheelBalance(ctx.from.id);
      await ctx.reply('✅ Колесо скасовано. Повертаємось у меню.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[wheel/exit] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // 📊 ІСТОРІЯ КОЛІС
  // ─────────────────────────────────────────────────────────

  bot.action('wheel_history', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const history = await flow.getWheelHistory(ctx.from.id);
      
      if (!history || history.length === 0) {
        await ctx.reply('📊 Історія коліс порожня', keyboards.mainMenuKeyboard());
        return;
      }

      const message = history
        .slice(0, 3)
        .map((rec, i) => {
          const date = rec.fields.Completed_Date || rec.fields.Created_Date;
          const score = rec.fields.Total_Score || '—';
          return `${i + 1}. ${date}: ${score}/80`;
        })
        .join('\n');

      await ctx.reply(`📊 **ІСТОРІЯ КОЛІС**\n\n${message}`, keyboards.wheelCompletedKeyboard());
    } catch (e) {
      logger.error('[wheel/history] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // 📝 TEXT HANDLER — обробляє нотатки
  // ─────────────────────────────────────────────────────────

  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message?.text?.trim();
      if (!text) return;

      const awaitingNote = await flow.isAwaitingNote(ctx.from.id);
      
      if (!awaitingNote) {
        // Не чекаємо нотатку від цього користувача
        return;
      }

      // Зберігаємо нотатку і переходимо далі
      const result = await flow.saveWheelNoteAndGoNext(ctx, text);

      if (result.error) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      } else if (result.completed) {
        await ctx.reply(result.message, keyboards.wheelCompletedKeyboard());
      } else {
        await ctx.reply(result.message, keyboards.wheelScoreKeyboard());
      }
    } catch (e) {
      logger.error('[wheel/text] ❌', e.message);
    }
  });

  console.log('✅ [wheelBalance] Всі хендлери зареєстровані');
}

// ═══════════════════════════════════════════════════════════
// 📤 ЕКСПОРТИ (для використання з інших модулів)
// ═══════════════════════════════════════════════════════════

// Flow функції
export const startWheelBalance = flow.startWheelBalance;
export const getLatestCompletedWheel = flow.getLatestCompletedWheel;
export const isAwaitingNote = flow.isAwaitingNote;
export const saveWheelNoteAndGoNext = flow.saveWheelNoteAndGoNext;

console.log('✅ [features/wheelBalance] Модуль завантажено');