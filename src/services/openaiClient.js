// src/services/openaiClient.js - ВИПРАВЛЕНО
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Перевіряємо наявність API ключа
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY не знайдено в .env файлі');
} else {
  console.log('✅ OPENAI_API_KEY знайдено');
}

export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export const chat = async (messages, model = 'gpt-4o-mini', max_tokens = 600) => {
  try {
    console.log(`[OpenAI] Запит до ${model}, токенів: ${max_tokens}`);
    
    const response = await openai.chat.completions.create({ 
      model, 
      messages, 
      max_tokens, 
      temperature: 0.7 
    });
    
    const result = response.choices?.[0]?.message?.content?.trim() || '';
    console.log(`[OpenAI] Відповідь отримано, довжина: ${result.length} символів`);
    
    return result;
  } catch (error) {
    console.error('[OpenAI] Помилка:', error.message || error);
    
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