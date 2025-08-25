// src/services/responseService.js
import { getBase, tables } from '../config/database.js';
const base = getBase();

const todayStr = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}${mm}${yyyy}`;
};

/**
 * Створює або оновлює рядок у Responses для сьогоднішнього дня
 * В одному рядку зберігаються і ранкові, і вечірні відповіді
 */
export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType,   // "Morning" або "Evening"
  answerStep,
  answer,
  fieldName
) => {
  try {
    const existingRecords = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND(
          {TG_id}="${tgId}",
          {User Name}="${userName}",
          DATETIME_FORMAT({Date Response}, 'DDMMYYYY')="${todayStr()}"
        )`
      })
      .firstPage();

    const responseData = {
      'TG_id': String(tgId),
      'User Name': userName,
      'Date Response': new Date().toISOString(),
      'Answer_Step': answerStep,
      [fieldName]: answer,
    };

    if (existingRecords.length > 0) {
      const record = existingRecords[0];
      const prevType = record.fields['Question Type'] || '';

      let newType = questionType;
      if (prevType && prevType !== questionType) {
        newType = `${prevType} + ${questionType}`;
      }

      responseData['Question Type'] = newType;

      return await base(tables.RESPONSES).update([
        { id: record.id, fields: responseData }
      ]);
    } else {
      responseData['Question Type'] = questionType;

      return await base(tables.RESPONSES).create([{ fields: responseData }]);
    }
  } catch (error) {
    console.error('[responseService] ❌ Error in createOrUpdateResponse:', error);
    throw error;
  }
};

export default { createOrUpdateResponse };
