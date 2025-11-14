// src/features/free5videos/index.js
import * as handlers from './handlers.js';

export default function initFree5Videos(bot) {
  console.log('🎬 [free5videos] Ініціалізація...');

  bot.command('5v', handlers.handleStart);

  bot.action('free5_start', handlers.handleStartFunnel);
  bot.action('free5_check_sub', handlers.handleCheckSubscription);
  bot.action(/^free5_video:(\d+)$/, handlers.handleVideoRequest);
  bot.action(/^free5_complete:(\d+)$/, handlers.handleVideoComplete);
  bot.action('free5_activate_bonus', handlers.handleActivateBonus);
  bot.action('free5_lives', handlers.handleShowLives);
  bot.action('free5_timer', handlers.handleShowTimer);
  bot.action('free5_progress', handlers.handleShowProgress);

  console.log('✅ [free5videos] Готово');
}