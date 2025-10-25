// src/bot/router.js

import initOnboarding from '../features/onboarding/index.js';
import initDailySessions from '../features/dailySessions/index.js';
import initWheelBalance from '../features/wheelBalance/index.js';
import initAIMentor from '../features/aiMentor/index.js';
import initSubscription from '../features/subscription/index.js';
import * as dashboard from '../features/dashboard/index.js';
import initReports from '../features/reports/index.js';
import initAffirmations from '../features/affirmations/index.js';
import initGamification from '../features/gamification/index.js';
import logger from '../utils/logger.js';

export const initRouter = (bot) => {
  logger.info('🤖 [router] Підключення модулів…');

  initOnboarding(bot);

  initDailySessions(bot);
  initWheelBalance(bot);
  initAIMentor(bot);
  initSubscription(bot);
  initReports(bot);
  initAffirmations(bot);
  initGamification(bot);

  bot.on('text', async (ctx) => {
    try {
      logger.info(`[router/text] "${ctx.message.text}" від ${ctx.from.id}`);

      // Спробуємо обробити у dashboard
      if (await dashboard.handleText(ctx)) {
        logger.info('[router/text] ✅ Оброблено dashboard');
        return;
      }

      logger.warn(`[router/text] ⚠️ Невідоме повідомлення: "${ctx.message.text}"`);
    } catch (e) {
      logger.error('[router/text]', e);
    }
  });

  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;
      logger.info(`[router/callback] "${data}" від ${ctx.from.id}`);

      if (await dashboard.handleCallback(ctx)) {
        logger.info('[router/callback] ✅ Оброблено dashboard');
        return;
      }

      logger.warn(`[router/callback] ⚠️ Невідомий callback: "${data}"`);
    } catch (e) {
      logger.error('[router/callback]', e);
    }
  });

  logger.info('✅ [router] Всі модулі готові');
};