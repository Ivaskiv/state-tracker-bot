// src/features/onboarding/index.js
// Роутинг для онбордингу

import { handleStart, handleCallback, handleText } from './handlers.js';

/**
 * Ініціалізація онбордингу
 */
export default function initOnboarding(bot) {
  console.log('🎓 [onboarding] Ініціалізація модуля...');

  // ВАЖЛИВО: /start команда реєструється ТУТ
  bot.start(async (ctx) => {
    try {
      console.log('[onboarding] /start від користувача:', ctx.from.id);
      await handleStart(ctx);
    } catch (error) {
      console.error('[onboarding/start] ❌ Помилка:', error);
      await ctx.reply('❌ Сталася помилка. Спробуй /start ще раз.');
    }
  });

  console.log('✅ [onboarding] Модуль готовий');
}

// Експортуємо handlers для використання в bot/router.js
export { handleStart, handleCallback, handleText };