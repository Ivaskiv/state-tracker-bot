// src/ai-mentor/services/aiMentorService.js
import { chat } from '../../services/openaiClient.js';
import responseService from '../../dialogue/services/responseService.js';
import { AI_MENTOR_PROMPTS, AI_MENTOR_CONFIG } from '../config/constants.js';

const systemPrompt = AI_MENTOR_PROMPTS.SYSTEM_PROMPT;

async function generateMicroActions(focusGoal, state, tgId) {
  try {
    // Отримуємо історію користувача за останні 7 днів
    const historyData = await getUserHistory(tgId);

    const prompt = `
      Ціль на сьогодні: "${focusGoal}"
      Стан користувача: "${state}"
      Історія за тиждень: ${JSON.stringify(historyData)}
      
      Згенеруй 3-5 конкретних мікро-дій на сьогодні у форматі JSON:
      {
        "microActions": [
          {"action": "текст дії", "priority": "висока|середня|низька", "tip": "порада"},
          ...
        ],
        "motivation": "коротка мотиваційна фраза"
      }
      
      Враховуй стан користувача - якщо нересурсний, роби легші дії.
    `;

    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      400
    );

    try {
      return JSON.parse(response);
    } catch {
      return getFallbackActions(focusGoal, state);
    }
  } catch (error) {
    console.error('[AIMentorService] Помилка генерації мікро-дій:', error);
    return getFallbackActions(focusGoal, state);
  }
}

async function provideDayFeedback(responses, state, goal) {
  try {
    const prompt = `
      Ціль дня: "${goal}"
      Стан: "${state}"
      Відповіді користувача: ${JSON.stringify(responses)}
      
      Дай короткий підтримуючий фідбек (до 100 слів) з позиції AI-наставника.
      Виділи головне досягнення та дай одну рекомендацію на завтра.
    `;

    const feedback = await chat(
      [
        { role: 'system', content: AI_MENTOR_PROMPTS.FEEDBACK_PROMPT },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      200
    );

    return feedback || AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  } catch (error) {
    console.error('[AIMentorService] Помилка генерації фідбеку:', error);
    return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  }
}

async function answerQuestion(question, userContext) {
  try {
    const prompt = `
      Питання користувача: "${question}"
      Контекст: ${JSON.stringify(userContext)}
      
      Відповідь як AI-наставник з трансформації. Коротко і по суті (до 150 слів).
    `;

    const answer = await chat(
      [
        { role: 'system', content: AI_MENTOR_PROMPTS.QUESTION_PROMPT },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    return answer || 'Вибач, не можу відповісти зараз. Спробуй перефразувати питання.';
  } catch (error) {
    console.error('[AIMentorService] Помилка відповіді на питання:', error);
    return 'Технічна помилка. Спробуй пізніше.';
  }
}

async function getUserHistory(tgId) {
  try {
    const records = await responseService.getUserRecords(tgId, 7);
    return records.map(r => ({
      date: r.fields.Date_Response || 'невідома дата',
      goal: r.fields.Q_m_4 || '',
      state: r.fields.Q_m_5 || '',
      victory: r.fields.Q_e_5 || ''
    }));
  } catch (error) {
    console.error('[AIMentorService] Помилка отримання історії:', error);
    return [];
  }
}

function getFallbackActions(focusGoal, state) {
  const s = (state || '').toLowerCase();
  const isResourceful =
    s.includes('енергія') || s.includes('сила') || s.includes('впевнен');

  return {
    microActions: [
      {
        action: isResourceful
          ? `Зроби 2 конкретні кроки до цілі: ${focusGoal}`
          : `Зроби 1 невеликий крок до цілі: ${focusGoal}`,
        priority: 'висока',
        tip: 'Почни з найпростішого'
      },
      {
        action: 'Зроби 5 хвилин медитації або дихальної вправи',
        priority: 'середня',
        tip: 'Для підтримки стану'
      },
      {
        action: 'Запиши 3 речі, за які вдячна сьогодні',
        priority: 'низька',
        tip: 'На випадок втоми'
      }
    ],
    motivation: 'Маленькі кроки ведуть до великих результатів! 💪'
  };
}

// Експорт у вигляді об’єкта (замість new Class)
const aiMentorService = {
  generateMicroActions,
  provideDayFeedback,
  answerQuestion,
  getUserHistory,
  getFallbackActions
};

export default aiMentorService;
