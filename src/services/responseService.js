// src/services/responseService.js
import { getBase, tables } from '../config/database.js';
const base = getBase();

// Формат дати для Date Response (ISO)
const todayStr = () => {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
};

// Створення або оновлення відповіді
export const createOrUpdateResponse = async (tgId, userName, questionType, answerStep, questionNumber, answer, fieldName, isCompleted = false) => {
  try {
    const existingRecords = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date Response})="${todayStr()}")`
      })
      .firstPage();
    const responseData = {
      'TG_id': String(tgId),
      'User Name': userName,
      'Date Response': new Date().toISOString(),
      [fieldName]: answer,
      ...(isCompleted && { [`${questionType.toLowerCase()}_completed`]: true })
    };
    if (existingRecords.length > 0) {
      const recordId = existingRecords[0].id;
      return await base(tables.RESPONSES).update([{ id: recordId, fields: responseData }]);
    } else {
      return await base(tables.RESPONSES).create([{ fields: responseData }]);
    }
  } catch (error) {
    console.error('[responseService] Помилка в createOrUpdateResponse:', error);
    throw error;
  }
};

// Перевірка завершення сесії
export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date Response})="${todayStr()}")`
      })
      .firstPage();
    if (records.length > 0) {
      return records[0].fields[`${questionType.toLowerCase()}_completed`] || false;
    }
    return false;
  } catch (error) {
    console.error('[responseService] Помилка в isSessionCompleted:', error);
    return false;
  }
};

export default { createOrUpdateResponse, isSessionCompleted };