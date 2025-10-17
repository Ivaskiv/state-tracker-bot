// ========================================
// src/features/wheelBalance/handlers.js
// ========================================
import logger from '../../utils/logger.js';

/**
 * Обробити callback вибору оцінки
 */
export const handleWheelScoreCallback = async (ctx, score) => {
  try {
    logger.info(`[wheelBalance/handlers] 🎯 Score: ${score}`);
    
    //Delegate to flow.processWheelAnswer
    const { processWheelAnswer } = await import('./flow.js');
    return await processWheelAnswer(ctx.from.id, score, ctx);
  } catch (error) {
    logger.error('[wheelBalance/handlers] ❌ Помилка:', error);
    return { error: true };
  }
};

console.log('✅ [wheelBalance/handlers] Завантажено');
