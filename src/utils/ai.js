// src/utils/ai.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * reflections — масив записів користувача (Morning/Evening)
 * type — 'Morning' | 'Evening'
 */
export async function generateAIAnalytics(reflections, type) {
  // збираємо текст для AI
  const userData = reflections.map(r => `
User Response: ${r.fields['User Response'] || ''}
Goal: ${r.fields['Goal'] || ''}
State: ${r.fields['State'] || ''}
Energy Gain: ${r.fields['Energy Gain'] || ''}
Energy Loss: ${r.fields['Energy Loss'] || ''}
Programs: ${r.fields['Programs'] || ''}
Victory: ${r.fields['Victory'] || ''}
Summary: ${r.fields['Summary'] || ''}
Affirmation: ${r.fields['Affirmation'] || ''}
`).join('\n');

  const prompt = `
Ти — експертний коуч трансформації. Створи для користувача ${type} афірмацію українською мовою та короткий аналітичний блок.
Вимоги: підтримуючий тон, фокус на ресурсах, 1-2 речення аналітики, афірмація 8-20 слів.
Дані користувача:
${userData}
`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const text = completion.choices[0].message.content.trim();

  // тут можна розбити текст на афірмацію та аналітику, якщо бажаєш
  const [affirmation, ...analytics] = text.split('\n');
  return {
    affirmation: affirmation || 'Не вдалося згенерувати афірмацію.',
    analyticsMessage: analytics.join('\n') || ''
  };
}
