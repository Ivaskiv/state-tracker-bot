// src/features/dailySessions/index.js
// ✅ 3-LEVEL ARCHITECTURE: Flow → Controller → Service
// ONE export: initDailySessions(bot) registers ALL handlers

import * as flow from './flow.js';
import * as controller from './controller.js';
import logger from '../../utils/logger.js';
import keyboards from '../../utils/keyboards.js';

/**
 * MAIN INIT FUNCTION — регіструє ВСІ хендлери для Daily Sessions
 */
export default function initDailySessions(bot) {
  console.log('📅 [dailySessions] Ініціалізація модуля…');

  // ═══════════════════════════════════════════════════════════
  // 🌞 РАНКОВА РЕФЛЕКСІЯ
  // ═══════════════════════════════════════════════════════════

  bot.action('start_morning', async (ctx) => {
    try {
      await controller.handleStartMorning(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/morning_start] ❌', e.message);
      await ctx.reply('❌ Помилка запуску ранкової сесії', keyboards.mainMenuKeyboard());
    }
  });

  bot.action('continue_morning', async (ctx) => {
    try {
      await controller.handleContinueMorning(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/morning_continue] ❌', e.message);
    }
  });

  bot.action('restart_morning', async (ctx) => {
    try {
      await controller.handleRestartMorning(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/morning_restart] ❌', e.message);
    }
  });

  bot.action('later_morning', async (ctx) => {
    try {
      await controller.handleLaterMorning(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/morning_later] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // 🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ
  // ─────────────────────────────────────────────────────────

  bot.action('start_evening', async (ctx) => {
    try {
      await controller.handleStartEvening(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/evening_start] ❌', e.message);
      await ctx.reply('❌ Помилка запуску вечірної сесії', keyboards.mainMenuKeyboard());
    }
  });

  bot.action('continue_evening', async (ctx) => {
    try {
      await controller.handleContinueEvening(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/evening_continue] ❌', e.message);
    }
  });

  bot.action('restart_evening', async (ctx) => {
    try {
      await controller.handleRestartEvening(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/evening_restart] ❌', e.message);
    }
  });

  bot.action('later_evening', async (ctx) => {
    try {
      await controller.handleLaterEvening(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/evening_later] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // 🚪 ВИХІД ІЗ СЕСІЇ
  // ─────────────────────────────────────────────────────────

  bot.action('exit_session', async (ctx) => {
    try {
      await controller.handleExitSession(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/exit] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────

  // ⏭️ ПРОПУСТИТИ РАНКОВІ, ПЕРЕЙТИ НА ВЕЧІР
  // ─────────────────────────────────────────────────────────

  bot.action('skip_morning_do_evening', async (ctx) => {
    try {
      await controller.handleSkipMorningDoEvening(ctx);
      await ctx.answerCbQuery();
    } catch (e) {
      logger.error('[daily/skip_morning] ❌', e.message);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 📝 TEXT HANDLER — обробляє відповіді користувача
  // ═══════════════════════════════════════════════════════════

  bot.on('text', async (ctx) => {
    try {
      const handled = await controller.handleText(ctx);
      if (!handled) {
        // Не наш кейс — пропускаємо
        return;
      }
    } catch (e) {
      logger.error('[daily/text] ❌', e.message);
      await ctx.reply('❌ Помилка обробки відповіді', keyboards.mainMenuKeyboard()).catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════
  // CALLBACK HANDLER (якщо потрібні додаткові callback-и)
  // ═══════════════════════════════════════════════════════════

  bot.action('main_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      // На цей момент main_menu обробляє dashboard модуль
      // Якщо потрібна логіка у daily — додамо тут
    } catch (e) {
      logger.error('[daily/main_menu] ❌', e.message);
    }
  });

  console.log('✅ [dailySessions] Всі хендлери зареєстровані');
}

// ═══════════════════════════════════════════════════════════
// 📤 ДОПОМІЖНІ ЕКСПОРТИ (якщо потрібні напряму з інших модулів)
// ═══════════════════════════════════════════════════════════

export { controller, flow };