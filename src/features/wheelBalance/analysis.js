import { chat } from '../../services/openaiClient.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES } from './constants.js';
import { WHEEL_ANALYSIS_PROMPT } from '../../config/prompts.js';

const SPHERE_NAMES = LIFE_SPHERES.map(s => String(s.label || s.key || '').trim() || 'Сфера');

/**
 * ✅ ВИПРАВЛЕНО: форматує імена сфер коректно
 */
export const generateWheelAnalysis = (scores = []) => {
  const n = LIFE_SPHERES.length;
  const arr = Array.from({ length: n }, (_, i) => Number(scores[i]) || 0);
  const total = arr.reduce((a, b) => a + b, 0);
  const avg = +(total / n).toFixed(1);

  // ✅ СИЛЬНІ СФЕРИ (≥8)
  const strong = [];
  arr.forEach((score, i) => {
    if (score >= 8) {
      const name = SPHERE_NAMES[i] || `Сфера ${i + 1}`;
      strong.push({ name, score });
    }
  });

  // ✅ СЛАБКІ СФЕРИ (≤5)
  const weak = [];
  arr.forEach((score, i) => {
    if (score <= 5) {
      const name = SPHERE_NAMES[i] || `Сфера ${i + 1}`;
      weak.push({ name, score });
    }
  });

  let out = `✅ **Середній бал: ${avg}/10**\n\n`;

  // ✅ СИЛЬНІ
  if (strong.length) {
    out += `🌟 **Сильні сфери (≥8):**\n`;
    strong.forEach(s => {
      out += `• ${s.name} (${s.score})\n`;
    });
    out += `\n`;
  } else {
    out += `🌟 **Сильні сфери:** поки без піків — це нормальний старт.\n\n`;
  }

  // ✅ СЛАБКІ
  if (weak.length) {
    out += `⚡ **Для розвитку (≤5):**\n`;
    weak.forEach(w => {
      out += `• ${w.name} (${w.score})\n`;
    });
    out += `\n`;
  } else {
    out += `⚡ **Для розвитку:** усі сфери в робочому діапазоні. Підтримуй темп.\n\n`;
  }

  // ✅ РЕКОМЕНДАЦІЯ
  if (weak.length) {
    const primary = weak[0];
    out += `🎯 **Фокус місяця:** підсилити «${primary.name}»\n`;
    out += `• Практика 25 хв 3×/тиждень\n`;
    out += `• Щоденний чек-ін: що вдалося/що завадило\n\n`;
  } else {
    out += `🎯 **Фокус місяця:** зберегти стабільність і додати глибину.\n\n`;
  }

  out += `📈 Раз на місяць оновлюй колесо — відстежуватимеш прогрес.`;
  return out;
};

/**
 * ✅ Форматування історії коліс (без [object Object])
 */
export const formatWheelHistory = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    return '📊 **ІСТОРІЯ КОЛІС**\n\nПоки порожньо. Пройди перше колесо — це 3–5 хв.';
  }

  let output = `📊 **ІСТОРІЯ КОЛІС**\n\n`;

  history.forEach((item, idx) => {
    const date = String(item.fields?.Completed_Date || item.date || '').slice(0, 10);
    const scores = Array.isArray(item.fields?.Health)
      ? [
          item.fields?.Health,
          item.fields?.Self_Growth,
          item.fields?.Relationships,
          item.fields?.Career_Business,
          item.fields?.Finance,
          item.fields?.Rest_Leisure,
          item.fields?.Spirituality,
          item.fields?.Housing
        ]
      : item.scores || [];

    const total = scores.reduce((a, b) => a + (Number(b) || 0), 0);
    const avg = +(total / 8).toFixed(1);

    output += `${idx + 1}. **${date}**: ${total}/80 (середня: ${avg}/10)\n`;
  });

  return output;
};

/**
 * ✅ Остання дата заповнення
 */
export const formatLastFilledDate = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) return '📅 Останнє заповнення: —';
  
  const last = history[0]?.fields?.Completed_Date || history[0]?.date;
  const iso = last ? String(last).slice(0, 10) : '—';
  
  return `📅 Останнє заповнення: ${iso}`;
};

/**
 * ✅ КОМПОЗИТНИЙ ВИВІД БЕЗ ПОМИЛОК
 */
export const buildWheelSummaryBlock = (history = []) => {
  const head = formatWheelHistory(history);
  const tail = formatLastFilledDate(history);
  
  let analysis = '';
  if (history.length > 0) {
    // Отримуємо оцінки з першого (останнього) запису
    const firstRecord = history[0];
    const scores = firstRecord.fields
      ? [
          firstRecord.fields.Health,
          firstRecord.fields.Self_Growth,
          firstRecord.fields.Relationships,
          firstRecord.fields.Career_Business,
          firstRecord.fields.Finance,
          firstRecord.fields.Rest_Leisure,
          firstRecord.fields.Spirituality,
          firstRecord.fields.Housing
        ].map(s => Number(s) || 0)
      : firstRecord.scores || [];

    analysis = generateWheelAnalysis(scores);
  }

  return [head, tail, '', '**AI Аналіз:**', analysis]
    .filter(Boolean)
    .join('\n');
};

/**
 * Викличи LLM з fallback
 */
export const analyzeWithAI = async (scores = []) => {
  try {
    const system = WHEEL_ANALYSIS_PROMPT.SYSTEM_PROMPT;
    const prompt = WHEEL_ANALYSIS_PROMPT.buildWheelAnalysisPrompt(scores, SPHERE_NAMES);
    
    if (!prompt) return generateWheelAnalysis(scores);

    let text = '';
    try {
      text = await chat([
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]);
    } catch (e1) {
      logger.warn('[wheelBalance/analyzeWithAI] fallback:', e1.message);
      return generateWheelAnalysis(scores);
    }

    return text && typeof text === 'string' ? text.trim() : generateWheelAnalysis(scores);
  } catch (err) {
    logger.error('[wheelBalance/analyzeWithAI]', err?.message || err);
    return generateWheelAnalysis(scores);
  }
};

console.log('✅ [wheelBalance/analysis] Завантажено (ВИПРАВЛЕНО)');