// AI аналіз
// src/services/wheelBalance/analysis.js
import { chat } from '../openaiClient.js';
import { LIFE_SPHERES } from './utils.js';
import logger from '../../utils/logger.js';

export const generateWheelAnalysis = async (scoresArr) => {
  try {
    const avgScore = (scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length).toFixed(1);
    const pairs = LIFE_SPHERES.map((name, i) => ({ name, score: scoresArr[i] || 0 }));
    
    const prompt =
      `Проаналізуй колесо балансу:\n\n` +
      `${pairs.map(s => `${s.name}: ${s.score}/10`).join('\n')}\n\n` +
      `Середній: ${avgScore}/10\n\n` +
      `Формат:\n` +
      `✅ Середній бал: ${avgScore}/10\n\n` +
      `🌟 Сильні: [2-3 найвищі з балами]\n` +
      `⚡ Увага: [≤5]\n` +
      `🎯 Рекомендації:\n• [3 конкретні дії]\n\n` +
      `До 120 слів, українською.`;

    const analysis = await chat(
      [
        { role: 'system', content: 'Ти коуч-аналітик. Даєш конкретні рекомендації.' },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    return analysis || createFallbackAnalysis(avgScore, pairs);
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка аналізу:', error);
    return createFallbackAnalysis(
      (scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length).toFixed(1),
      LIFE_SPHERES.map((name, i) => ({ name, score: scoresArr[i] || 0 }))
    );
  }
};

const createFallbackAnalysis = (avgScore, pairs) => {
  const weak = pairs.filter(s => s.score <= 5);
  const strong = pairs.filter(s => s.score >= 8);
  
  return (
    `✅ Середній бал: ${avgScore}/10\n\n` +
    `🌟 Сильні: ${strong.length > 0 ? strong.map(s => `${s.name} (${s.score})`).join(', ') : 'потребують підтримки'}\n` +
    `⚡ Увага: ${weak.length > 0 ? weak.map(s => `${s.name} (${s.score})`).join(', ') : 'всі збалансовані'}\n\n` +
    `🎯 Зосередься на сферах ≤5 - це точки росту.\n\n` +
    `📈 Відстежуй прогрес щомісяця.`
  );
};