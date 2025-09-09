// src/ai-coach/services/aiCoachService.js
import { chat } from '../../services/openaiClient.js';
import userService from '../../auth/services/userService.js';
import responseService from '../../dialogue/services/responseService.js';

const generateMicroActions = async (focusGoal, userState, tgId) => {
  try {
    const historyRecords = await responseService.getUserRecords(tgId, 7);
    const historyData = historyRecords.map(r => ({
      goal: r.fields.Q_m_4 || '',
      state: r.fields.Q_m_5 || '',
      victory: r.fields.Q_e_5 || ''
    }));

    const prompt = `Ти AI-наставник для щоденних мікро-дій.

Користувач має:
- Ціль на сьогодні: "${focusGoal}"
- Стан: "${userState}"
- Історія за тиждень: ${JSON.stringify(historyData)}

Створи 3-5 конкретних мікро-дій на сьогодні у форматі JSON:
{
  "microActions": [
    {
      "action": "конкретна дія",
      "priority": "висока/середня/альтернатива",
      "tip": "короткий поради як виконати",
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

    const response = await chat([
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 400);

    return JSON.parse(response);
  } catch (error) {
    console.error('[aiCoachService] Помилка генерації мікро-дій:', error);
    return {
      microActions: [
        {
          action: "Зроби один маленький крок до своєї цілі",
          priority: "висока",
          tip: "Почни з найпростішого",
          timeEstimate: "15 хв"
        }
      ],
      motivation: "Кожен маленький крок наближає тебе до мети! 💪"
    };
  }
};

const generatePersonalizedAdvice = async (question, tgId) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const recentRecords = await responseService.getUserRecords(tgId, 14);
    
    const userContext = recentRecords.slice(0, 3).map(r => ({
      goals: [r.fields.Q_m_3, r.fields.Q_m_4].filter(Boolean),
      state: r.fields.Q_m_5,
      programs: r.fields.Q_e_3,
      victories: r.fields.Q_e_5
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

    const response = await chat([
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    return response || "🎯 Твоє питання важливе!\n💡 Почни з одного маленького кроку вперед\n✨ Ти вже на правильному шляху! 💪";
  } catch (error) {
    console.error('[aiCoachService] Помилка генерації поради:', error);
    return "🎯 Дякую за запитання!\n💡 Довіряй своїй інтуїції та роби крок за кроком\n✨ У тебе все вийде! 🌟";
  }
};

export default {
  generateMicroActions,
  generatePersonalizedAdvice
};