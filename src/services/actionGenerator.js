// src/services/actionGenerator.js
// Простий генератор дій — повертає або існуючі microActions від AI, або fallback

export const generate = async (payload = {}, aiResult = {}) => {
  try {
    // Якщо AI вже згенерував дії - повертаємо їх
    if (aiResult && Array.isArray(aiResult.microActions) && aiResult.microActions.length > 0) {
      return aiResult.microActions;
    }

    // Інакше - генерація простих fallback дій
    const focusGoal = payload.focusGoal || payload.goal || 'твоя ціль';
    const state = payload.state || '';

    const now = new Date();
    const start = new Date(now);
    start.setMinutes(now.getMinutes() + 15);

    const end = new Date(start);
    end.setMinutes(start.getMinutes() + 15);

    return [
      {
        action: `Зроби крок до цілі: ${focusGoal}`,
        time: `${start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}-${end.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`,
        duration_min: 15,
        result_metric: '1 крок завершено',
        priority: 'висока',
        tip: 'Почни з найпростішого — 15 хв концентрації'
      }
    ];
  } catch (error) {
    console.error('[actionGenerator] Error:', error);
    return [];
  }
};

export default { generate };
