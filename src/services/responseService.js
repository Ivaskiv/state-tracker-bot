// src/services/responseService.js
// src/services/responseService.js
import { getBase } from '../config/database.js';
import { QUESTION_TYPES } from '../config/constants.js';

// Створення або оновлення відповіді в Airtable
export const createOrUpdateResponse = async (tgId, userName, questionType, currentStep, questionNumber, answer, fieldName, isComplete = false) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0]; // Формат: YYYY-MM-DD (наприклад, 2025-08-25)
    const tgIdString = String(tgId); // Приведення tgId до рядка

    // Пошук існуючого запису за TG_id і Date Response
    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id} = "${tgIdString}", {Date Response} = "${today}")`,
    }).firstPage();

    let fields = { TG_id: tgIdString, 'User Name': userName, 'Date Response': today };
    if (isComplete) {
      fields[questionType === QUESTION_TYPES.MORNING ? 'morning_completed' : 'evening_completed'] = true;
      fields[questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e'] = answer;
    } else {
      fields[fieldName] = answer;
    }

    if (records.length > 0) {
      // Оновлення існуючого запису
      await base('Responses').update(records[0].id, fields);
      console.log(`[responseService] Оновлено запис для ${tgIdString}, ${today}, ${fieldName}`);
    } else {
      // Створення нового запису
      await base('Responses').create(fields);
      console.log(`[responseService] Створено запис для ${tgIdString}, ${today}, ${fieldName}`);
    }
  } catch (error) {
    console.error('[responseService] Помилка в createOrUpdateResponse:', error);
    throw error;
  }
};

// Перевірка завершення сесії
export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0]; // Формат: YYYY-MM-DD
    const tgIdString = String(tgId); // Приведення tgId до рядка
    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id} = "${tgIdString}", {Date Response} = "${today}")`,
    }).firstPage();

    if (records.length === 0) return false;
    const field = questionType === QUESTION_TYPES.MORNING ? 'morning_completed' : 'evening_completed';
    return !!records[0].fields[field];
  } catch (error) {
    console.error('[responseService] Помилка в isSessionCompleted:', error);
    return false;
  }
};

export default { createOrUpdateResponse, isSessionCompleted };