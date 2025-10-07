// src/services/responseProcessor.js
// Обробка сирої відповіді від OpenAI: витягуємо JSON, дії, тригери, визначаємо needsActions

export const process = async (rawResponse = '', type = '') => {
  try {
    let text = typeof rawResponse === 'string' ? rawResponse.trim() : JSON.stringify(rawResponse);
    let actions = [];
    let triggers = [];
    let classification = null;
    let needsActions = false;

    // 1) Спроба знайти JSON-блок з microActions
    const jsonRegex = /\{[\s\S]*"microActions"[\s\S]*\}/;
    const jsonMatch = text.match(jsonRegex);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.microActions && Array.isArray(parsed.microActions)) {
          actions = parsed.microActions;
          // видаляємо JSON з тексту
          text = text.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        console.warn('[responseProcessor] JSON parse failed:', e.message);
      }
    }

    // 2) Проста перевірка на наявність слів, що означають дії/кроки
    const lowered = text.toLowerCase();
    needsActions = type === 'smart_convert' ||
                   lowered.includes('дія') ||
                   lowered.includes('крок') ||
                   actions.length > 0;

    // 3) Базове витягнення тригерів (ключові слова)
    const triggerKeywords = ['страх', 'тривог', 'втом', 'перевантаж', 'прокрастин'];
    triggerKeywords.forEach(k => {
      if (lowered.includes(k)) triggers.push(k);
    });

    // 4) Класифікація (можна покращити пізніше NLP)
    if (lowered.includes('страх') || lowered.includes('тривог')) classification = 'емоційний блок';
    else if (lowered.includes('перевантаж') || lowered.includes('втом')) classification = 'перевантаження';
    else if (lowered.includes('план') || lowered.includes('не вистачає план')) classification = 'відсутність плану';

    return {
      text,
      actions,
      triggers,
      classification,
      needsActions,
      needsFollowUp: triggers.length > 0
    };
  } catch (error) {
    console.error('[responseProcessor] Error:', error);
    return { text: String(rawResponse), actions: [], triggers: [], classification: null, needsActions: false };
  }
};

export default { process };
