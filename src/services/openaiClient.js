import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Ініціалізація OpenAI клієнта
 */
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('[openaiClient] ❌ OPENAI_API_KEY не встановлено в .env');
} else {
  console.log('[openaiClient] ✅ OPENAI_API_KEY знайдено');
}

export const openai = new OpenAI({ 
  apiKey: apiKey
});

/**
 * Відправити запит до OpenAI API
 */
export const chat = async (messages, model = 'gpt-4o-mini', maxTokens = 1000) => {
  try {
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY');
    }


    const response = await openai.chat.completions.create({
      model: model,
      max_tokens: maxTokens,
      messages: messages,
      temperature: 0.7
    });

    console.log('[openaiClient] 📡 Response status: 200 (успішно)');

    const result = response.choices?.[0]?.message?.content?.trim();

    if (!result) {
const fallbacks = [
        "🎯 Для досягнення цілі розбий її на маленькі кроки та діяй послідовно.",
        "💪 Твоя сила — в постійності. Щодня один крок — і досяжеш мети.",
        "✨ Почни з однієї дії сьогодні. Довіряй процесу.",
        "🌱 Кожен день — можливість рости. Що ти можеш зробити прямо зараз?"
      ];        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
    return result;

  } catch (error) {
    console.error('[openaiClient] ❌ Помилка:', error.message);
    
    // Fallback відповіді
    const fallbacks = [
      "🎯 Для досягнення цілі важливо розбити її на маленькі кроки та діяти послідовно.",
      "💪 Твоя сила в постійності. Роби невеликі кроки щодня - вони ведуть до великих результатів.",
      "✨ Сфокусуйся на одній дії сьогодні. Довіряй процесу та своїй здатності рости.",
      "🌱 Кожен день - це можливість стати кращою версією себе. Почни з того, що можеш зробити прямо зараз."
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};

/**
 * Спрощена версія для коротких запитів
 */
export const simpleChat = async (userMessage, systemPrompt = 'Ти корисний асистент.') => {
  return chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]);
};

export default {
  chat,
  simpleChat
};

console.log('✅ [services/openaiClient] OpenAI клієнт завантажено');