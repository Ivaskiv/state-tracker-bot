// src/features/affirmations/index.js
import * as controller from './controller.js';

export default function initAffirmations(bot) {
  console.log('💎 [affirmations] Ініціалізація…');

  // Text команди
  bot.hears(/афірмація|мотивація|фокус/i, (ctx) => 
    controller.showAffirmation(ctx, 'general')
  );

  // Callback дії
  bot.action(/affirmation_next_(\w+)/, (ctx) => {
    const type = ctx.match[1];
    controller.showAffirmation(ctx, type);
  });

  console.log('✅ [affirmations] Готово');
}

export const publicApi = { showAffirmation: controller.showAffirmation };