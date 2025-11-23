// src/tilda/index.js
import controller from './controller.js';
import { TILDA_CALLBACKS, TILDA_COMMANDS } from './constants.js';
import logger from '../utils/logger.js';

export default function initTildaIntegration(bot) {
  logger.info('🌐 [Tilda] Ініціалізація модуля...');

  // ─────────────────────────────────────────────────────────
  // 📢 КОМАНДИ
  // ─────────────────────────────────────────────────────────
  
  bot.command(TILDA_COMMANDS.CABINET, controller.openMemberArea);
  bot.command(TILDA_COMMANDS.TILDA, controller.openMemberArea);

  // ─────────────────────────────────────────────────────────
  // 🎯 CALLBACK ACTIONS
  // ─────────────────────────────────────────────────────────
  
  bot.action(TILDA_CALLBACKS.OPEN_CABINET, async (ctx) => {
    await ctx.answerCbQuery();
    await controller.openMemberArea(ctx);
  });

  bot.action(TILDA_CALLBACKS.REFRESH_TOKEN, controller.refreshToken);
  
  bot.action(TILDA_CALLBACKS.UPGRADE_ACCESS, controller.upgradeAccess);
  
  bot.action(TILDA_CALLBACKS.VIEW_SUBSCRIPTION, controller.viewSubscriptionInfo);

  logger.info('✅ [Tilda] Модуль готовий');
}

// Експорт для використання в інших модулях
export { default as controller } from './controller.js';
export { default as service } from './service.js';
export * from './constants.js';
export * from './config.js';

console.log('✅ [features/tilda] Модуль завантажено');
