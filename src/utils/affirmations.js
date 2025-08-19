// src/utils/affirmations.js
import { openai } from '../services/openaiClient.js';
import { selectFromTable } from '../services/airtableClient.js';

export const AFFIRMATIONS = {
  async getRandom() {
    try {
      // 1. Генеруємо афірмацію через OpenAI
      const prompt = `Створи унікальну мотиваційну афірмацію українською, 8–20 слів, підтримуючу, теплу, для особистого розвитку та впевненості.`;
      const response = await openai.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60
      });

      const generated = response?.data?.choices?.[0]?.message?.content?.trim();
      if (generated) return generated;

      // 2. Якщо AI не дав результат, беремо з Airtable
      const records = await selectFromTable('Affirmations', {
        maxRecords: 50,
        filterByFormula: "NOT({Used})"
      }).firstPage();

      if (!records.length) return 'Не вдалося згенерувати унікальну афірмацію.';

      const record = records[0];
      await record.patchUpdate({ Used: true });

      return record.fields.Affirmation || 'Не вдалося згенерувати унікальну афірмацію.';

    } catch (error) {
      console.error('Error fetching affirmation:', error);
      return 'Не вдалося згенерувати унікальну афірмацію.';
    }
  }
};
