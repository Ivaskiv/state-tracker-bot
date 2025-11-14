// src/bot/router.js

import initOnboarding from '../features/registration/index.js';
import initDailySessions from '../features/dailySessions/index.js';
import initWheelBalance from '../features/wheelBalance/index.js';
import initAIMentor from '../features/aiMentor/index.js';
import initSubscription from '../core/subscription/index.js';
import * as dashboard from '../features/dashboard/index.js';
import initReports from '../features/reports/index.js';
import initAffirmations from '../features/affirmations/index.js';
import logger from '../utils/logger.js';
import initGamification from '../core/gamification/index.js';
import initFreeVideoFunnel from '../features/free5videos/index.js';

export const initRouter = (bot) => {
  logger.info('🤖 [router] Підключення модулів…');

  // Кожен модуль сам реєструє текст/колбек хендлери всередині
  initOnboarding(bot);
  initDailySessions(bot);
  initWheelBalance(bot);
  initAIMentor(bot);
  initSubscription(bot);
  initReports(bot);
  initAffirmations(bot);
  initGamification(bot);
  initFreeVideoFunnel(bot);


  // Текст: спочатку даємо шанс dashboard, інакше інші фічі вже підписані
  bot.on('text', async (ctx) => {
    try {
      if (await dashboard.handleText?.(ctx)) return;
    } catch (e) {
      logger.error('[router/text]', e);
    }
  });

  // Fallback для callback_query: лог, шанс dashboard, і тихе ACK щоб не крутився спінер
  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery?.data;
      logger.info(`[router/callback] "${data}" від ${ctx.from.id}`);

      // Якщо у dashboard є централізований обробник — спробуємо
      if (await dashboard.handleCallback?.(ctx)) {
        logger.info('[router/callback] ✅ Оброблено dashboard');
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      // Тихе підтвердження будь-якого не перехопленого callback'а
      try { await ctx.answerCbQuery(); } catch {}
    } catch (e) {
      logger.error('[router/callback]', e);
      try { await ctx.answerCbQuery('Помилка'); } catch {}
    }
  });

  logger.info('✅ [router] Всі модулі готові');
};
