// src/features/dailySessions/index.js

import * as controller from './controller.js';
import logger from '../../utils/logger.js';
import keyboards from '../../utils/keyboards.js';

export default function initDailySessions(bot) {
  console.log('📅 [dailySessions] Ініціалізація…');

  const actions = {
    'start_morning': controller.handleStartMorning,
    'continue_morning': controller.handleContinueMorning,
    'restart_morning': controller.handleRestartMorning,
    'later_morning': controller.handleLaterMorning,
    'start_evening': controller.handleStartEvening,
    'continue_evening': controller.handleContinueEvening,
    'restart_evening': controller.handleRestartEvening,
    'later_evening': controller.handleLaterEvening,
    'skip_morning_do_evening': controller.handleSkipMorningDoEvening,
    'exit_session': controller.handleExitSession,
  };

  Object.entries(actions).forEach(([action, handler]) => {
    bot.action(action, async (ctx) => {
      try {
        await handler(ctx);
        await ctx.answerCbQuery();
      } catch (e) {
        logger.error(`[daily/${action}]`, e.message);
        await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard()).catch(() => {});
      }
    });
  });

  bot.on('text', async (ctx) => {
    try {
      await controller.handleText(ctx);
    } catch (e) {
      logger.error('[daily/text]', e.message);
    }
  });

  console.log('✅ [dailySessions] Готово');
}