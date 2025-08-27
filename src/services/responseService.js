// src/services/responseService.js
import { getBase } from '../config/database.js';
import { QUESTION_TYPES } from '../config/constants.js';

/**
 * Створення або оновлення відповіді в Airtable - ОДИН ЗАПИС НА ДЕНЬ
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

    // ✅ Шукаємо ОДИН запис на день БЕЗ розділення по типу питань
    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", {Date Response}="${today}")`,
      maxRecords: 1
    }).firstPage();

    // Базові дані
    const baseFields = {
      'TG_id': tgIdString,
      'User Name': userName,
      'Date Response': today,
    };

    // Додаємо конкретну відповідь
    const updateFields = {
      ...baseFields,
      [fieldName]: answer
    };

    // Додаємо прапорець завершення відповідного типу питань
    if (isCompleted) {
      if (questionType === QUESTION_TYPES.MORNING) {
        updateFields['morning_completed'] = true;
      } else if (questionType === QUESTION_TYPES.EVENING) {
        updateFields['evening_completed'] = true;
      }
    }

    if (records.length > 0) {
      // ✅ Оновлюємо існуючий запис
      await base('Responses').update([{ 
        id: records[0].id, 
        fields: updateFields 
      }]);
      console.log(`[responseService] ✅ Оновлено запис для ${tgIdString}, ${today}, поле: ${fieldName}`);
    } else {
      // ✅ Створюємо новий запис
      await base('Responses').create([{ 
        fields: updateFields 
      }]);
      console.log(`[responseService] ✅ Створено новий запис для ${tgIdString}, ${today}, поле: ${fieldName}`);
    }
  } catch (error) {
    console.error('[responseService] ❌ Помилка createOrUpdateResponse:', error);
    throw error;
  }
};

/**
 * Перевірка завершення сесії - перевіряємо в одному записі
 */
export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    const tgIdString = String(tgId);

    // ✅ Шукаємо ОДИН запис на день
    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", {Date Response}="${today}")`,
      maxRecords: 1
    }).firstPage();

    if (!records.length) return false;

    // Перевіряємо відповідне поле завершення
    const completedField = questionType === QUESTION_TYPES.MORNING
      ? 'morning_completed'
      : 'evening_completed';

    return !!records[0].fields[completedField];
  } catch (error) {
    console.error('[responseService] ❌ Помилка isSessionCompleted:', error);
    return false;
  }
};

/**
 * Отримання запису за день для користувача
 */
export const getDayRecord = async (tgId, date = null) => {
  try {
    const base = getBase();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const tgIdString = String(tgId);

    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", {Date Response}="${targetDate}")`,
      maxRecords: 1
    }).firstPage();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('[responseService] ❌ Помилка getDayRecord:', error);
    return null;
  }
};

/**
 * Отримання записів користувача за період
 */
export const getUserRecords = async (tgId, days = 7) => {
  try {
    const base = getBase();
    const tgIdString = String(tgId);
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", IS_AFTER({Date Response}, "${sinceDateStr}"))`,
      sort: [{ field: 'Date Response', direction: 'desc' }]
    }).all();

    return records;
  } catch (error) {
    console.error('[responseService] ❌ Помилка getUserRecords:', error);
    return [];
  }
};

export default { 
  createOrUpdateResponse, 
  isSessionCompleted, 
  getDayRecord,
  getUserRecords 
};