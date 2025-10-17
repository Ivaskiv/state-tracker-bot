// src/features/wheelBalance/analysis.js — ФІНАЛЬНА ВЕРСІЯ (за ТЗ §5.5)

import { chat } from '../../services/openaiClient.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES, WHEEL_ANALYSIS_PROMPT } from '../../config/index.js';

/**
 * Згенерувати аналіз колеса балансу
 * ТЗ §5.5: "Очікується введення 8 чисел 0–10 → зберегти WheelBalance, 
 * сгенерувати інсайти/плани, запропонувати місячні пріоритети (2–3)"
 */
export const generateWheelAnalysis = async (scoresArr) => {
  try {
    // ✅ Перевірка вхідних даних
    if (!Array.isArray(scoresArr) || scoresArr.length !== 8) {
      logger.error('[wheelBalance/analysis] ❌ Невірна кількість оцінок:', scoresArr.length);
      return createFallbackAnalysis(scoresArr);
    }

    // ✅ Отримуємо назви сфер із config (ТЗ має 8 сфер)
    const sphereNames = LIFE_SPHERES.map(s => s.label || s.key);

    // ✅ Будуємо промпт відповідно до WHEEL_ANALYSIS_PROMPT
    const prompt = WHEEL_ANALYSIS_PROMPT.buildWheelAnalysisPrompt(scoresArr, sphereNames);

    logger.info('[wheelBalance/analysis] 📋 Промпт готово, відправляємо AI');

    const analysis = await chat(
      [
        { 
          role: 'system', 
          content: WHEEL_ANALYSIS_PROMPT.SYSTEM_PROMPT 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      'gpt-4o-mini',
      500 // Достатньо токенів для якісного аналізу
    );

    if (!analysis) {
      logger.warn('[wheelBalance/analysis] ⚠️ Порожня відповідь від AI');
      return createFallbackAnalysis(scoresArr, sphereNames);
    }

    logger.info('[wheelBalance/analysis] ✅ Аналіз отримано від AI');
    return analysis;

  } catch (error) {
    logger.error('[wheelBalance/analysis] ❌ Помилка AI:', error.message);
    const sphereNames = LIFE_SPHERES.map(s => s.label || s.key);
    return createFallbackAnalysis(scoresArr, sphereNames);
  }
};

/**
 * Fallback аналіз (ТЗ §5.5: інсайти/плани + місячні пріоритети)
 * Структура: Середній → Сильні → Слабкі → Дії → Фокус місяця → Мотивація
 */
const createFallbackAnalysis = (scoresArr, sphereNames = null) => {
  try {
    // ✅ Отримуємо назви сфер
    const names = sphereNames || LIFE_SPHERES.map(s => s.label || s.key);

    // ✅ Базова статистика
    const avgScore = scoresArr.length > 0 
      ? (scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length).toFixed(1)
      : 0;

    const totalScore = scoresArr.reduce((a, b) => a + b, 0);

    // ✅ Знаходимо сильні (≥8) та слабкі (≤5) сфери
    const pairs = scoresArr.map((score, i) => ({
      name: names[i] || `Сфера ${i + 1}`,
      score
    }));

    const strong = pairs.filter(s => s.score >= 8);
    const weak = pairs.filter(s => s.score <= 5);
    const medium = pairs.filter(s => s.score > 5 && s.score < 8);

    // ✅ ФІНАЛЬНА СТРУКТУРА (відповідно до ТЗ та WHEEL_ANALYSIS_PROMPT)
    let analysis = '';

    // 1️⃣ Заголовок та середній бал
    analysis += `✅ Середній бал: ${avgScore}/10\n`;
    analysis += `📊 Загальна оцінка: ${totalScore}/80\n\n`;

    // 2️⃣ Сильні сфери (ТЗ: запропонувати місячні пріоритети)
    if (strong.length > 0) {
      analysis += `🌟 **Сильні сфери (≥8):**\n`;
      strong.forEach(s => {
        analysis += `• ${s.name}: ${s.score}/10\n`;
      });
      analysis += '\n';
    } else {
      analysis += `🌟 **Сильні сфери:** немає (всі збалансовані)\n\n`;
    }

    // 3️⃣ Сфери для розвитку (ТЗ: "точки росту")
    if (weak.length > 0) {
      analysis += `⚡ **Для розвитку (≤5):**\n`;
      weak.forEach(s => {
        analysis += `• ${s.name}: ${s.score}/10\n`;
      });
      analysis += '\n';
    } else {
      analysis += `⚡ **Для розвитку:** всі в нормі (≥6)\n\n`;
    }

    // 4️⃣ Збалансовані сфери (опціонально)
    if (medium.length > 0 && medium.length <= 3) {
      analysis += `⚖️ **Збалансовані (6–7):**\n`;
      medium.forEach(s => {
        analysis += `• ${s.name}: ${s.score}/10\n`;
      });
      analysis += '\n';
    }

    // 5️⃣ Конкретні дії (ТЗ §5.5: "місячні пріоритети (2–3)")
    analysis += `🎯 **Конкретні дії на місяць:**\n`;
    
    if (weak.length > 0) {
      const topWeak = weak.slice(0, 2);
      topWeak.forEach((w, idx) => {
        analysis += `• Дія ${idx + 1}: Покращити "${w.name}" на 2–3 пункти через мікро-кроки (25 хв/день)\n`;
      });
    } else {
      analysis += `• Дія 1: Зберегти висоти в сильних сферах\n`;
      analysis += `• Дія 2: Дослідити можливості для глибшого розвитку\n`;
    }
    
    analysis += `• Дія 3: Встановити один фокус на місяць\n\n`;

    // 6️⃣ Місячний пріоритет (ТЗ §5.5)
    if (weak.length > 0) {
      const top = weak[0];
      analysis += `💡 **Місячний пріоритет:** Покращити "${top.name}" \n`;
      analysis += `Чому: це твоя найбільша точка росту\n\n`;
    } else {
      const worstMedium = medium.length > 0 ? medium[0] : pairs[0];
      analysis += `💡 **Місячний пріоритет:** Досліджувати "${worstMedium.name}"\n`;
      analysis += `Чому: це основа для стабільності\n\n`;
    }

    // 7️⃣ Мотивація (ТЗ: лаконічна, без пафосу)
    analysis += `📈 Твій баланс > 7.5/10 — це чудовий результат! Продовжуй відстежувати прогрес щомісяця. 💪\n`;

    return analysis;

  } catch (error) {
    logger.error('[wheelBalance/analysis] ❌ Помилка fallback:', error.message);
    
    // ✅ Ультра-fallback (якщо навіть fallback впав)
    return (
      `✅ Колесо балансу завершено!\n\n` +
      `📊 Твої оцінки збережено в Airtable.\n\n` +
      `🎯 Рекомендація: переглянь результати та встанови один фокус на наступний місяць.\n\n` +
      `📈 Обновлюй коліс раз на місяць для відстеження прогресу. 💪`
    );
  }
};

console.log('✅ [wheelBalance/analysis] Аналіз завантажено (ТЗ §5.5)');