// src/utils/ai.js
// src/utils/ai.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { getRandomAffirmation } from './airtable.js'; // функція для вибору випадкової афірмації з таблиці

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * reflections — масив записів користувача (Morning/Evening)
 * type — 'Morning' | 'Evening'
 */
export async function generateAIAnalytics(reflections, type) {
  // Якщо немає даних — одразу беремо випадкову афірмацію
  if (!reflections || reflections.length === 0) {
    const fallback = await getRandomAffirmation();
    return { affirmation: fallback, analyticsMessage: '' };
  }

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

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from OpenAI');

    const [affirmation, ...analytics] = text.split('\n');
    return {
      affirmation: affirmation || (await getRandomAffirmation()),
      analyticsMessage: analytics.join('\n') || ''
    };
  } catch (err) {
    console.error('AI analytics error:', err);
    const fallback = await getRandomAffirmation();
    return { affirmation: fallback, analyticsMessage: '' };
  }
}
