// src/services/prompts/index.js
import { AI_MENTOR_PROMPTS } from '../../config/constants.js';

export const getPrompt = (type, data = {}) => {
  // helper для безпечного підстановлення
  const safe = (v) => (v === undefined || v === null) ? '' : v;

  const prompts = {
    morning: {
      system: AI_MENTOR_PROMPTS.SYSTEM_PROMPT,
      user: `${AI_MENTOR_PROMPTS.MORNING_PROMPT}

Контекст користувача:
- Стан: ${safe(data.state)}
- Ціль дня: ${safe(data.goal)}
- Якості: ${Array.isArray(data.qualities) ? data.qualities.join(', ') : safe(data.qualities)}
- Короткий userContext: ${safe(JSON.stringify(data.userContext || {}))}
      
Дай короткий мотиваційний текст (<=120 слів) + 1-3 конкретні дії у форматі JSON в полі "actions".`,
      maxTokens: 300
    },

    evening: {
      system: AI_MENTOR_PROMPTS.SYSTEM_PROMPT,
      user: `${AI_MENTOR_PROMPTS.EVENING_PROMPT}

Контекст:
- Відповіді: ${safe(JSON.stringify(data.responses || {}))}
- Стан: ${safe(data.state)}
- Ціль: ${safe(data.goal)}

Потрібен короткий JSON (summary_text, classification, recommendations).`,
      maxTokens: 300
    },

    smart_convert: {
      system: AI_MENTOR_PROMPTS.SMART_CONVERTER_PROMPT,
      user: `${AI_MENTOR_PROMPTS.SMART_CONVERTER_PROMPT}

ВХІД:
- Дія(ї): ${safe(data.focusGoal || data.actions || '')}
- Контекст користувача: ${safe(JSON.stringify(data.userContext || {}))}

КРИТИЧНО: Поверни лише валідний JSON відповідно до опису в SMART_CONVERTER_PROMPT (масив об'єктів або об'єкт з microActions). Без додаткового тексту.`,
      maxTokens: 500
    },

    weekly: {
      system: AI_MENTOR_PROMPTS.WEEKLY_PROMPT,
      user: `${AI_MENTOR_PROMPTS.WEEKLY_PROMPT}

Дані: ${safe(JSON.stringify(data.records || []))}
Потрібен JSON з полями (report_text, skills, next_week_actions).`,
      maxTokens: 500
    },

    monthly: {
      system: AI_MENTOR_PROMPTS.MONTHLY_PROMPT,
      user: `${AI_MENTOR_PROMPTS.MONTHLY_PROMPT}

Дані: ${safe(JSON.stringify(data.records || []) )}
Потрібен JSON з полями (balance_index, insights, recommend_priorities, pdf_note).`,
      maxTokens: 600
    },

    trigger: {
      system: AI_MENTOR_PROMPTS.SYSTEM_PROMPT,
      user: `${AI_MENTOR_PROMPTS.TRIGGER_PROMPT}

Вхідні дані: ${safe(JSON.stringify({
        missed_days_count: data.missed_days_count,
        low_activity_weeks_count: data.low_activity_weeks_count,
        last_response_text: data.last_response_text
      }))}

Поверни JSON { message, options } згідно опису.`,
      maxTokens: 250
    },

    general: {
      system: AI_MENTOR_PROMPTS.SYSTEM_PROMPT,
      user: `${AI_MENTOR_PROMPTS.FEEDBACK_PROMPT}

Контекст: ${safe(JSON.stringify(data.userContext || {}))}
Питання/тема: ${safe(data.question || '')}

Дай коротку, конкретну пораду (<=120 слів).`,
      maxTokens: 300
    }
  };

  // повертаємо відповідь або дефолт
  return prompts[type] || prompts.morning;
};

export default { getPrompt };
