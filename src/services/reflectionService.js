// src/services/reflectionService.js
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const reflectionService = {
  async saveMorningAnswer(ctx, text, qNum) {
    try {
      await base('Morning_Responses').create([{
        fields: {
          user_id: ctx.from.id,
          [`question_${qNum}`]: text
        }
      }]);
      console.log(`✅ Збережено ранкову відповідь Q${qNum} для користувача ${ctx.from.id}`);
    } catch (err) {
      console.error('❌ Error saving morning answer:', err);
    }
  },

  async saveEveningAnswer(ctx, text, qNum) {
    try {
      await base('Evening_Responses').create([{
        fields: {
          user_id: ctx.from.id,
          [`question_${qNum}`]: text
        }
      }]);
      console.log(`✅ Збережено вечірню відповідь Q${qNum} для користувача ${ctx.from.id}`);
    } catch (err) {
      console.error('❌ Error saving evening answer:', err);
    }
  }
};

export default reflectionService;
