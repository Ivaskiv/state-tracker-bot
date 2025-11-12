// src/features/freeVideoFunnel/index.js
import * as controller from './controller.js';
import logger from '../../utils/logger.js';
import callbacks from '../../services/callbacks.js'; // Якщо використовується, інакше bot.action

export default function initFreeVideoFunnel(bot) {
  logger.info('🎬 [freeVideoFunnel] Ініціалізація...');

  bot.command('5v', controller.handleStartFunnel);

  callbacks.on('start_funnel', controller.handleStartFunnel);
  callbacks.on('check_subscription', controller.handleCheckSubscription);
  callbacks.on(/^video_(\d+)$/, (ctx) => controller.handleVideoRequest(ctx, parseInt(ctx.match[1])));
  callbacks.on(/^complete_(\d+)$/, (ctx) => controller.handleVideoComplete(ctx, parseInt(ctx.match[1])));
  callbacks.on('activate_bonus', controller.handleActivateBonus);
  callbacks.on('continue_funnel', controller.handleContinueFunnel);
  callbacks.on('restart_funnel', controller.handleRestartFunnel);
  callbacks.on('show_timer', controller.handleShowTimer);
  callbacks.on('show_lives', controller.handleShowLives);
  callbacks.on('show_status', controller.handleShowStatus);
  callbacks.on('main_menu', controller.handleMainMenu);
  callbacks.on('exit_to_tilda', controller.handleExitToTilda);

  logger.info('✅ [freeVideoFunnel] Готово');
}