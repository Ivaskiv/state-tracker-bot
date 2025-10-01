// src/aiMentor/services/aiMentorService.js - ФІНАЛЬНА ВЕРСІЯ З ЗБЕРЕЖЕННЯМ

import { chat } from './openaiClient.js';
import userService from './userService.js';
import responseService from '../dialogue/services/responseService.js';
import activityTracker from './activityTracker.js';
import { AI_MENTOR_PROMPTS, AI_MENTOR_CONFIG } from '../config/constants.js';

const systemPrompt = AI_MENTOR_PROMPTS.SYSTEM_PROMPT;

// ===== SMART-КОНВЕРТАЦІЯ МІКРО-ДІЙ =====

async function generateMicroActions(focusGoal, state, tgId) {
  console.log(`[aiMentorService] 🎯 ВИКЛИКАНО generateMicroActions`);
  console.log(`[aiMentorService] - tgId: ${tgId}`);
  console.log(`[aiMentorService] - Ціль: "${focusGoal}"`);
  console.log(`[aiMentorService] - Стан: "${state}"`);
  
  try {
    // 1. Збираємо контекст
    console.log(`[aiMentorService] 📊 Збір контексту користувача...`);
    const historyData = await getUserHistory(tgId);
    const userContext = await buildUserContext(tgId);
    console.log(`[aiMentorService] ✅ Контекст зібрано (продуктивність: ${userContext.avgProductivity}%)`);

    // 2. Формуємо промпт
    const currentTime = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const isResourceful = state.toLowerCase().includes('енергія') || state.toLowerCase().includes('ресурс');
    
    const prompt = `Ти AI-наставник для SMART мікро-дій згідно з методологією "Очі в очі".

📋 КОНТЕКСТ:
- Ціль: "${focusGoal}"
- Стан: "${state}"
- Продуктивність: ${userContext.avgProductivity}%
- Час фокусу: ${userContext.typicalFocusTime}

🎯 СТВОРИ 3 SMART МІКРО-ДІЇ У JSON:

{
  "microActions": [
    {
      "action": "Конкретна дія з дієсловом",
      "time": "HH:MM-HH:MM",
      "duration_min": 25,
      "result_metric": "Вимірюваний результат",
      "priority": "висока",
      "tip": "Як виконати за 1 крок"
    }
  ],
  "state_booster": "Дія для підтримки стану (5-10 хв)",
  "weekly_milestone": "Проміжна ціль на тиждень",
  "motivation": "Мотиваційна фраза"
}

📏 ВИМОГИ:
1️⃣ Дія 1 (ГОЛОВНА, 15-25 хв): наближає до "${focusGoal}"
2️⃣ Дія 2 (ПІДТРИМУЮЧА, 10-15 хв): підтримує стан
3️⃣ Дія 3 (ЗАПАСНА, 5-10 хв): альтернатива

⚙️ Стан: ${isResourceful ? 'РЕСУРСНИЙ → 25 хв фокусу' : 'НЕРЕСУРСНИЙ → 10-15 хв'}
📍 Поточний час: ${currentTime}

⚡ КРИТИЧНО:
- Час у форматі "10:00-10:25" від ПОТОЧНОГО часу
- result_metric = число/обсяг
- Українською мовою
- ТІЛЬКИ конкретні дії`;

    // 3. Запит до OpenAI
    console.log(`[aiMentorService] 🤖 Відправка запиту до OpenAI...`);
    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      500
    );
    console.log(`[aiMentorService] ✅ OpenAI відповідь отримано (${response.length} символів)`);

    // 4. Парсинг та валідація
    let validated;
    try {
      console.log(`[aiMentorService] 🔍 Парсинг JSON відповіді...`);
      const parsed = JSON.parse(response);
      console.log(`[aiMentorService] ✅ JSON успішно розпарсено`);
      
      console.log(`[aiMentorService] 🔧 Валідація SMART-параметрів...`);
      validated = validateAndEnhanceSMARTActions(parsed, focusGoal, state);
      console.log(`[aiMentorService] ✅ Валідація пройдена, дій: ${validated.microActions.length}`);
      
    } catch (parseError) {
      console.error(`[aiMentorService] ❌ Помилка парсингу:`, parseError.message);
      console.log(`[aiMentorService] 🔄 Використовуємо SMART fallback`);
      validated = getSMARTFallbackActions(focusGoal, state);
    }
    
    // 5. Збереження в БД
    console.log(`[aiMentorService] 💾 Збереження мікро-дій в БД...`);
    console.log(`[aiMentorService] - Кількість дій: ${validated.microActions.length}`);
    
    try {
      await activityTracker.saveMicroActions(tgId, validated.microActions);
      await saveGeneratedActionsToConversation(tgId, validated);

      console.log(`[aiMentorService] ✅ Мікро-дії збережено в БД`);
    } catch (saveError) {
      console.error(`[aiMentorService] ❌ Помилка збереження:`, saveError.message);
      console.error(`[aiMentorService] Stack:`, saveError.stack);
    }
    
    console.log(`[aiMentorService] 🎉 generateMicroActions завершено успішно`);
    return validated;
    
  } catch (error) {
    console.error('[aiMentorService] ❌ КРИТИЧНА ПОМИЛКА:', error.message);
    console.error('[aiMentorService] Stack:', error.stack);
    
    console.log(`[aiMentorService] 🔄 Використовуємо SMART fallback після помилки`);
    const fallbackActions = getSMARTFallbackActions(focusGoal, state);
    
    // Спроба збереження fallback
    try {
      console.log(`[aiMentorService] 💾 Збереження fallback мікро-дій...`);
      await activityTracker.saveMicroActions(tgId, fallbackActions.microActions);
      console.log(`[aiMentorService] ✅ Fallback мікро-дії збережено`);
    } catch (saveError) {
      console.error('[aiMentorService] ❌ Помилка збереження fallback:', saveError.message);
    }
    
    return fallbackActions;
  }
}
// ===== ЗБЕРЕЖЕННЯ AI ДІАЛОГУ =====
async function saveAIConversation(tgId, question, aiResponse, contextType = 'advice') {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    await base(tables.AI_CONVERSATIONS || 'AI_Conversations').create({
      TG_id: String(tgId),
      Date: new Date().toISOString().split('T')[0],
      User_Question: question,
      AI_Response: aiResponse,
      Context_Type: contextType,
      Created_At: new Date().toISOString()
    });
    
    console.log(`[aiMentorService] 💾 AI діалог збережено для ${tgId}`);
    
  } catch (error) {
    console.error('[saveAIConversation] Помилка:', error);
  }
}

const saveGeneratedActionsToConversation = async (tgId, actionsData) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    
    // Оновлюємо останній запис діалогу
    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Date}="${today}")`,
        maxRecords: 1,
        sort: [{ field: 'Created_At', direction: 'desc' }]
      })
      .firstPage();
    
    if (records.length > 0) {
      const actionsText = actionsData.microActions
        .map((a, i) => `${i+1}. ${a.action} (${a.time}, ${a.duration_min}хв)`)
        .join('\n');
      
      await base(tables.AI_CONVERSATIONS).update(records[0].id, {
        Generated_Actions: actionsText
      });
    }
  } catch (error) {
    console.error('[saveGeneratedActionsToConversation]:', error);
  }
};

// ===== ВАЛІДАЦІЯ ТА ПОКРАЩЕННЯ SMART-ДІЙ =====
function validateAndEnhanceSMARTActions(parsed, focusGoal, state) {
  const now = new Date();
  const isResourceful = state.toLowerCase().includes('енергія') || 
                        state.toLowerCase().includes('ресурс') ||
                        state.toLowerCase().includes('сила');
  
  // Валідуємо та покращуємо кожну дію
  const enhancedActions = (parsed.microActions || []).map((action, index) => {
    const enhanced = { ...action };
    
    // ✅ 1. ДОДАЄМО ЧАС якщо відсутній
    if (!enhanced.time || !enhanced.time.includes('-')) {
      const startTime = new Date(now);
      startTime.setMinutes(now.getMinutes() + (index * 30) + 15);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(startTime.getMinutes() + (enhanced.duration_min || 15));
      
      enhanced.time = `${formatTime(startTime)}-${formatTime(endTime)}`;
      console.log(`[aiMentorService] ⏰ Додано час для дії ${index + 1}: ${enhanced.time}`);
    }
    
    // ✅ 2. ДОДАЄМО МЕТРИКУ якщо відсутня
    if (!enhanced.result_metric || enhanced.result_metric.length < 5) {
      enhanced.result_metric = suggestMetricForAction(enhanced.action, focusGoal);
      console.log(`[aiMentorService] 📊 Додано метрику: ${enhanced.result_metric}`);
    }
    
    // ✅ 3. ВАЛІДУЄМО ТРИВАЛІСТЬ
    if (!enhanced.duration_min || enhanced.duration_min < 5) {
      enhanced.duration_min = index === 0 ? 25 : (index === 1 ? 15 : 10);
    }
    
    // ✅ 4. КОРИГУЄМО ЗА СТАНОМ
    if (!isResourceful && enhanced.duration_min > 20) {
      enhanced.duration_min = 15;
      enhanced.tip = 'Короткий крок, щоб зберегти енергію';
    }
    
    // ✅ 5. ДОДАЄМО ПРІОРИТЕТ
    if (!enhanced.priority) {
      enhanced.priority = index === 0 ? 'висока' : (index === 1 ? 'середня' : 'низька');
    }
    
    return enhanced;
  });
  
  return {
    microActions: enhancedActions,
    state_booster: parsed.state_booster || getStateBooster(state),
    weekly_milestone: parsed.weekly_milestone || `Прогрес до: ${focusGoal}`,
    motivation: parsed.motivation || 'Дія — це твоя мова проти страху. Почни зараз! 💪',
    generated_at: now.toISOString(),
    smart_validated: true
  };
}

// ===== ГЕНЕРАЦІЯ МЕТРИКИ ДЛЯ ДІЇ =====
function suggestMetricForAction(actionText, goalText) {
  const action = actionText.toLowerCase();
  
  if (action.includes('написати') || action.includes('текст')) {
    return '300-500 слів написано';
  }
  if (action.includes('дзвінок') || action.includes('зателефон')) {
    return '1 розмова завершена';
  }
  if (action.includes('ліди') || action.includes('клієнт')) {
    return '3-5 лідів оброблено';
  }
  if (action.includes('план') || action.includes('стратегія')) {
    return '1 сторінка плану готова';
  }
  if (action.includes('код') || action.includes('програм')) {
    return '50-100 рядків коду';
  }
  if (action.includes('email') || action.includes('лист')) {
    return '5 листів відправлено';
  }
  if (action.includes('зустріч') || action.includes('мітинг')) {
    return '1 зустріч проведена';
  }
  
  return '1 завдання завершено';
}

// ===== ПІДТРИМКА СТАНУ =====
function getStateBooster(state) {
  const s = state.toLowerCase();
  
  if (s.includes('втом') || s.includes('енергі') && s.includes('мало')) {
    return '5 хв прогулянка або дихальна вправа (4-4-4)';
  }
  if (s.includes('стрес') || s.includes('тривог')) {
    return '10 хв медитація або музика для заспокоєння';
  }
  if (s.includes('розсіян') || s.includes('фокус')) {
    return '2 хв Deep Work таймер + відключення сповіщень';
  }
  
  return '5 хв фізична активність (розминка, присідання)';
}

// ===== SMART FALLBACK ДІЇ =====
function getSMARTFallbackActions(focusGoal, state) {
  console.log(`[aiMentorService] 🔄 Використовуємо SMART fallback`);
  
  const now = new Date();
  const isResourceful = state.toLowerCase().includes('енергія') || 
                        state.toLowerCase().includes('ресурс');
  
  const time1Start = new Date(now);
  time1Start.setMinutes(now.getMinutes() + 15);
  const time1End = new Date(time1Start);
  time1End.setMinutes(time1Start.getMinutes() + (isResourceful ? 25 : 15));
  
  const time2Start = new Date(time1End);
  time2Start.setMinutes(time1End.getMinutes() + 10);
  const time2End = new Date(time2Start);
  time2End.setMinutes(time2Start.getMinutes() + 10);
  
  return {
    microActions: [
      {
        action: isResourceful
          ? `Зроби 2 конкретні кроки до цілі: ${focusGoal}`
          : `Зроби 1 простий крок до цілі: ${focusGoal}`,
        time: `${formatTime(time1Start)}-${formatTime(time1End)}`,
        duration_min: isResourceful ? 25 : 15,
        result_metric: '1 крок завершено',
        priority: 'висока',
        tip: 'Почни з найпростішого та зрозумілого'
      },
      {
        action: 'Підтримай енергію: 5-10 хв фізична активність або медитація',
        time: `${formatTime(time2Start)}-${formatTime(time2End)}`,
        duration_min: 10,
        result_metric: '10 хв відновлення',
        priority: 'середня',
        tip: 'Це підтримає стан для наступних дій'
      },
      {
        action: 'Запиши 3 речі, за які вдячна сьогодні + 1 перемога',
        time: 'будь-коли',
        duration_min: 5,
        result_metric: '4 записи зроблено',
        priority: 'низька',
        tip: 'На випадок втоми - легка підтримка'
      }
    ],
    state_booster: getStateBooster(state),
    weekly_milestone: `Стабільний прогрес до: ${focusGoal}`,
    motivation: 'Маленькі кроки ведуть до великих результатів! 💪',
    generated_at: now.toISOString(),
    smart_validated: true,
    is_fallback: true
  };
}

// ===== ФОРМАТУВАННЯ ЧАСУ =====
function formatTime(date) {
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

// ===== КОНТЕКСТ КОРИСТУВАЧА =====
async function buildUserContext(tgId) {
  try {
    const records = await responseService.getUserRecords(tgId, 7);
    
    let totalDays = records.length;
    let completedDays = records.filter(r => r.fields?.Q_e_5).length;
    
    let avgProductivity = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 50;
    
    let typicalFocusTime = avgProductivity > 70 ? '25-30 хв' : 
                           avgProductivity > 50 ? '15-25 хв' : 
                           '10-15 хв';
    
    return {
      avgProductivity,
      typicalFocusTime,
      recentWins: records.slice(0, 3).map(r => r.fields?.Q_e_5).filter(Boolean),
      recentGoals: records.slice(0, 3).map(r => r.fields?.Q_m_4).filter(Boolean)
    };
  } catch (error) {
    console.error('[buildUserContext] Помилка:', error);
    return {
      avgProductivity: 50,
      typicalFocusTime: '15-25 хв',
      recentWins: [],
      recentGoals: []
    };
  }
}

// ===== ПЕРСОНАЛІЗОВАНА ПОРАДА З ЗБЕРЕЖЕННЯМ =====
async function generatePersonalizedAdvice(question, tgId) {
  try {
    console.log(`[aiMentorService] Генерація поради для питання: "${question}"`);
    
    const user = await userService.getUserByTgId(tgId);
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
    
    // ✅ ЗБЕРІГАЄМО ДІАЛОГ
    await saveAIConversation(tgId, question, response, 'advice');
    
    return response || "🎯 Твоє питання важливе!\n💡 Почни з одного маленького кроку вперед\n✨ Ти вже на правильному шляху! 💪";
  } catch (error) {
    console.error('[aiMentorService] Помилка генерації поради:', error);
    return "🎯 Дякую за запитання!\n💡 Довіряй своїй інтуїції та роби крок за кроком\n✨ У тебе все вийде! 🌟";
  }
}

// ===== ФІДБЕК ДНЯ З ЗБЕРЕЖЕННЯМ =====
async function provideDayFeedback(responses, state, goal, tgId) {
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

    // ✅ ЗБЕРІГАЄМО ФІДБЕК
    if (tgId) {
      await saveAIConversation(tgId, 'День завершено', feedback, 'feedback');
    }

    return feedback || AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  } catch (error) {
    console.error('[aiMentorService] Помилка генерації фідбеку:', error);
    return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  }
}

// ===== ІСТОРІЯ КОРИСТУВАЧА =====
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

// DEPRECATED
function getFallbackActions(focusGoal, state) {
  return getSMARTFallbackActions(focusGoal, state);
}

export default {
  generateMicroActions,
  generatePersonalizedAdvice,
  provideDayFeedback,
  getUserHistory,
  getFallbackActions,
  getSMARTFallbackActions,
  saveAIConversation,
  saveGeneratedActionsToConversation
}; 