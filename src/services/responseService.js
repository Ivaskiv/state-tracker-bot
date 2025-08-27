// src/services/responseService.js
import { getBase } from '../config/database.js';
import { QUESTION_TYPES } from '../config/constants.js';

/**
 * Створення або оновлення відповіді в Airtable
 */
export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType, // "Morning" або "Evening"
  answerStep,
  questionNumber,
  answer,
  fieldName,
  isCompleted = false
) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tgIdString = String(tgId);

    // Пошук існуючого запису
    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", {Date Response}="${today}", {Question Type}="${questionType}")`,
      maxRecords: 1
    }).firstPage();

    // Дані для збереження
    const fields = {
      'TG_id': tgIdString,
      'User Name': userName,
      'Date Response': today,
      'Question Type': questionType,
      [fieldName]: answer
    };

    // Додаємо прапорець завершення
    if (isCompleted) {
      const completedField = questionType === QUESTION_TYPES.MORNING
        ? 'morning_completed'
        : 'evening_completed';
      fields[completedField] = true;
    }

    if (records.length > 0) {
      await base('Responses').update([{ id: records[0].id, fields }]);
      console.log(`[responseService] Оновлено запис для ${tgIdString}, ${today}, ${fieldName}`);
    } else {
      await base('Responses').create([{ fields }]);
      console.log(`[responseService] Створено запис для ${tgIdString}, ${today}, ${fieldName}`);
    }
  } catch (error) {
    console.error('[responseService] Помилка createOrUpdateResponse:', error);
    throw error;
  }
};

/**
 * Перевірка завершення сесії
 */
export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    const tgIdString = String(tgId);

    // 🔑 Виправлено: було {Type}, стало {Question Type}
    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", {Date Response}="${today}", {Question Type}="${questionType}")`,
      maxRecords: 1
    }).firstPage();

    if (!records.length) return false;

    const completedField = questionType === QUESTION_TYPES.MORNING
      ? 'morning_completed'
      : 'evening_completed';

    return !!records[0].fields[completedField];
  } catch (error) {
    console.error('[responseService] Помилка isSessionCompleted:', error);
    return false;
  }
};

export default { createOrUpdateResponse, isSessionCompleted };
