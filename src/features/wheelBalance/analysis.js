import { chat } from '../../services/openaiClient.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES } from './constants.js';
import { WHEEL_ANALYSIS_PROMPT } from '../../config/prompts.js';

const SPHERE_NAMES = LIFE_SPHERES.map(s => String(s.label || s.key || '').trim() || 'Сфера');

/** Текстова аналітика без LLM (емпатійний коуч-стиль, списки стовпчиком) */
export const generateWheelAnalysis = (scores = []) => {
  const n = SPHERE_NAMES.length;
  const arr = Array.from({ length: n }, (_, i) => Number(scores[i]) || 0);
  const total = arr.reduce((a, b) => a + b, 0);
  const avg = +(total / n).toFixed(1);

  const strong = [];
  const weak = [];
  arr.forEach((score, i) => {
    const name = SPHERE_NAMES[i] || `Сфера ${i + 1}`;
    if (score >= 8) strong.push({ name, score });
    if (score <= 5) weak.push({ name, score });
  });

  let out = `✅ **Твій баланс: ${avg}/10**\n\n`;

  if (strong.length) {
    out += `🌟 **Сильні сфери (≥8):**\n`;
    strong.forEach(s => { out += `• ${s.name}: ${s.score}/10\n`; });
    out += `\n`;
  } else {
    out += `🌟 **Сильні сфери:** поки без піків — це нормальний старт.\n\n`;
  }

  if (weak.length) {
    out += `⚡ **Зони росту (≤5):**\n`;
    weak.forEach(w => { out += `• ${w.name}: ${w.score}/10\n`; });
    out += `\n`;
  } else {
    out += `⚡ **Зони росту:** усі сфери в робочому діапазоні. Підтримуй темп.\n\n`;
  }

  if (weak.length) {
    const primary = weak[0];
    out += `🎯 **Фокус місяця:** підсилити «${primary.name}». Маленькі кроки щодня > великі ривки раз на тиждень.\n`;
    out += `• 25 хв 3×/тиждень на практику саме цієї сфери\n`;
    out += `• Щоденний чек-ін 2 хвилини ввечері: що вдалося/що завадило\n\n`;
  } else {
    out += `🎯 **Фокус місяця:** зберегти стабільність і додати одну «глибоку» звичку 25 хв 2×/тиждень.\n\n`;
  }

  out += `📈 Раз на місяць оновлюй колесо — відстежуватимеш помітний прогрес.`;
  return out;
};

/** Побудова user-прохань для LLM */
const buildWheelPrompt = (scores) =>
  WHEEL_ANALYSIS_PROMPT.buildWheelAnalysisPrompt(scores, SPHERE_NAMES);

/** Виклик LLM з fallbacks */
export const analyzeWithAI = async (scores = []) => {
  try {
    const system = WHEEL_ANALYSIS_PROMPT.SYSTEM_PROMPT;
    const prompt = buildWheelPrompt(scores);
    if (!prompt) return createFallbackAnalysis(scores);

    let text = '';
    try {
      text = await chat(system, prompt);
    } catch (e1) {
      try {
        text = await chat({ system, prompt });
      } catch (e2) {
        logger.warn('[wheelBalance/analyzeWithAI] fallback to local analysis');
        return createFallbackAnalysis(scores);
      }
    }

    if (!text || typeof text !== 'string') {
      return createFallbackAnalysis(scores);
    }
    return text.trim();
  } catch (err) {
    logger.error('[wheelBalance/analyzeWithAI]', err?.message || err);
    return createFallbackAnalysis(scores);
  }
};

/** Локальний коуч-аналіз, коли LLM недоступний */
const createFallbackAnalysis = (scores = []) => generateWheelAnalysis(scores);

/** Форматування історії коліс */
export const formatWheelHistory = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    return '📊 **ІСТОРІЯ КОЛІС**\nПоки порожньо. Пройди перше колесо — це 3–5 хв.';
  }

  const lines = history.map((item, idx) => {
    const date = String(item.date || item.createdAt || '').slice(0, 10);
    const scores = Array.isArray(item.scores) ? item.scores : [];
    const total = scores.reduce((a, b) => a + (Number(b) || 0), 0);
    return `${idx + 1}. ${date || '—'}: ${total}/80`;
  });

  return `📊 **ІСТОРІЯ КОЛІС**\n${lines.join('\n')}`;
};

/** Окремий рядок «Останнє заповнення: YYYY-MM-DD» */
export const formatLastFilledDate = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) return '📅 Останнє заповнення: —';
  const last = history
    .map(h => new Date(h.date || h.createdAt || 0))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b - a)[0];

  const iso = last ? last.toISOString().slice(0, 10) : '—';
  return `📅 Останнє заповнення: ${iso}`;
};

/** Композитний вивід: історія + остання дата + базовий аналіз (без LLM) */
export const buildWheelSummaryBlock = (history = []) => {
  const head = formatWheelHistory(history);
  const tail = formatLastFilledDate(history);
  let analysis = '';

  if (history.length > 0 && Array.isArray(history[0].scores)) {
    analysis = generateWheelAnalysis(history[0].scores);
  }

  return [head, tail, '', '**AI Аналіз:**', analysis].join('\n');
};
