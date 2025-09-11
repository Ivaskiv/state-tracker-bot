// src/aiMentor/services/aiMentorService.js - виправлення
import { chat } from '../../services/openaiClient.js';
import userService from '../../auth/services/userService.js';
import responseService from '../../dialogue/services/responseService.js';
import { AI_MENTOR_PROMPTS, AI_MENTOR_CONFIG } from '../../config/constants.js';

const systemPrompt = AI_MENTOR_PROMPTS.SYSTEM_PROMPT;

async function generateMicroActions(focusGoal, state, tgId) {
  try {
    console.log(`[aiMentorService] Генерація мікро-дій для цілі: "${focusGoal}", стан: "${state}"`);
    
    const historyData = await getUserHistory(tgId);

    const prompt = `Ти AI-наставник для щоденних мікро-дій.

Користувач має:
- Ціль на сьогодні: "${focusGoal}"
- Стан: "${state}"
- Історія за тиждень: ${JSON.stringify(historyData)}

Створи 3 конкретні мікро-дії на сьогодні у форматі JSON:
{
  "microActions": [
    {
      "action": "конкретна дія",
      "priority": "висока/середня/низька",
      "tip": "коротка порада як виконати",
      "timeEstimate": "15-30 хв"
    }
  ],
  "motivation": "коротка мотиваційна фраза 1 речення"
}

Вимоги:
- Дія 1: ключова для прогресу цілі
- Дія 2: підтримуюча стан/енергію  
- Дія 3: альтернатива якщо не вдалося Дію 1
- Якщо стан нересурсний → легкі кроки
- Якщо ресурсний → більш амбітні дії
- Українською мовою
- Конкретні дії, не загальні поради`;

    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      400
    );

    console.log(`[aiMentorService] OpenAI відповідь: ${response}`);

    try {
      const parsed = JSON.parse(response);
      console.log(`[aiMentorService] JSON успішно розпарсено`);
      return parsed;
    } catch (parseError) {
      console.error(`[aiMentorService] Помилка парсингу JSON:`, parseError);
      return getFallbackActions(focusGoal, state);
    }
  } catch (error) {
    console.error('[aiMentorService] Помилка генерації мікро-дій:', error);
    return getFallbackActions(focusGoal, state);
  }
}

async function generatePersonalizedAdvice(question, tgId) {
  try {
    console.log(`[aiMentorService] Генерація поради для питання: "${question}"`);
    
    const user = await userService.getUserByTelegramId(tgId);
    const recentRecords = await responseService.getUserRecords(tgId, 14);
    
    const userContext = recentRecords.slice(0, 3).map(r => ({
      goals: [r.fields?.Q_m_3, r.fields?.Q_m_4].filter(Boolean),
      state: r.fields?.Q_m_5,
      programs: r.fields?.Q_e_3,
      victories: r.fields?.Q_e_5
    }));

    const prompt = `Ти експертний AI-наставник рівня Tony Robbins.

Користувач питає: "${question}"

Контекст користувача за останні 2 тижні: ${JSON.stringify(userContext)}

Дай персоналізовану відповідь:
- З позиції "ти вже маєш силу всередині"
- Конкретні мікро-дії, не загальні поради  
- Враховуй його цілі та стан з контексту
- До 100 слів
- Підтримуючий тон
- Українською мовою

Формат:
🎯 [короткий інсайт про ситуацію]
💡 [1-2 конкретні дії]  
✨ [мотиваційне закриття]`;

    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    console.log(`[aiMentorService] Порада згенерована, довжина: ${response.length}`);
    
    return response || "🎯 Твоє питання важливе!\n💡 Почни з одного маленького кроку вперед\n✨ Ти вже на правильному шляху! 💪";
  } catch (error) {
    console.error('[aiMentorService] Помилка генерації поради:', error);
    return "🎯 Дякую за запитання!\n💡 Довіряй своїй інтуїції та роби крок за кроком\n✨ У тебе все вийде! 🌟";
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
    console.error('[aiMentorService] Помилка генерації фідбеку:', error);
    return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  }
}

async function getUserHistory(tgId) {
  try {
    const records = await responseService.getUserRecords(tgId, 7);
    return records.map(r => ({
      date: r.fields?.Date_Response || 'невідома дата',
      goal: r.fields?.Q_m_4 || '',
      state: r.fields?.Q_m_5 || '',
      victory: r.fields?.Q_e_5 || ''
    }));
  } catch (error) {
    console.error('[aiMentorService] Помилка отримання історії:', error);
    return [];
  }
}

function getFallbackActions(focusGoal, state) {
  console.log(`[aiMentorService] Використовуємо fallback дії`);
  
  const s = (state || '').toLowerCase();
  const isResourceful =
    s.includes('енергія') || s.includes('сила') || s.includes('впевнен') || s.includes('ресурс');

  return {
    microActions: [
      {
        action: isResourceful
          ? `Зроби 2 конкретні кроки до цілі: ${focusGoal}`
          : `Зроби 1 невеликий крок до цілі: ${focusGoal}`,
        priority: 'висока',
        tip: 'Почни з найпростішого',
        timeEstimate: '15-30 хв'
      },
      {
        action: 'Зроби 5 хвилин медитації або дихальної вправи',
        priority: 'середня',
        tip: 'Для підтримки стану',
        timeEstimate: '5 хв'
      },
      {
        action: 'Запиши 3 речі, за які вдячна сьогодні',
        priority: 'низька',
        tip: 'На випадок втоми',
        timeEstimate: '5-10 хв'
      }
    ],
    motivation: 'Маленькі кроки ведуть до великих результатів! 💪'
  };
}

export default {
  generateMicroActions,
  generatePersonalizedAdvice,
  provideDayFeedback,
  getUserHistory,
  getFallbackActions
};