// src/services/responseService.js
import { getBase } from '../../config/database.js';
import { QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../../config/constants.js';

/**
 * Створення або оновлення відповіді в Airtable - ОДИН ЗАПИС НА ДЕНЬ
 */
export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType,   // QUESTION_TYPES.MORNING | QUESTION_TYPES.EVENING
  answerStep,     // поточний крок (наприклад: 'Q_m_1', 'Q_m_6', 'End_m' тощо)
  questionNumber, // номер питання (1..n)
  answer,         // текст відповіді
  fieldName,      // колонка для збереження (напр. 'Q_m_1', 'Q_m_6')
  isCompleted = false
) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tgIdString = String(tgId);

    // ✅ Шукаємо існуючий запис на цей день
    const existingRecords = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1
    }).firstPage();

    // Готуємо поля до оновлення
    const fieldsToUpdate = {
      'Answer_Step': answerStep
    };

    // Динамічна логіка на основі кількості питань
    const maxMorningQuestions = MORNING_QUESTIONS.length;
    const maxEveningQuestions = EVENING_QUESTIONS.length;

    if (questionType === QUESTION_TYPES.MORNING) {
      if (answerStep === 'End_m' || questionNumber > maxMorningQuestions) {
        // Це афірмація - зберігаємо в affirmation_m
        fieldsToUpdate['affirmation_m'] = answer;
      } else {
        // Це звичайне питання Q1-Q6+
        fieldsToUpdate[fieldName] = answer;
      }
    }

    if (questionType === QUESTION_TYPES.EVENING) {
      if (answerStep === 'End_e' || questionNumber > maxEveningQuestions) {
        // Це афірмація - зберігаємо в affirmation_e
        fieldsToUpdate['affirmation_e'] = answer;
      } else {
        // Це звичайне питання Q1-Q5+
        fieldsToUpdate[fieldName] = answer;
      }
    }

    if (existingRecords.length > 0) {
      // ✅ ОНОВЛЮЄМО
      const recordId = existingRecords[0].id;
      await base('Responses').update([{ 
        id: recordId,
        fields: fieldsToUpdate 
      }]);
      console.log(`[responseService] ✅ ОНОВЛЕНО запис ${recordId} для ${tgIdString}. Q#${questionNumber}, field="${fieldName}"`);
    } else {
      // ✅ СТВОРЮЄМО
      const newRecordFields = {
        'TG_id': tgIdString,
        'User Name': userName,
        'Date Response': today,
        ...fieldsToUpdate
      };
      
      const [newRecord] = await base('Responses').create([{ fields: newRecordFields }]);
      console.log(`[responseService] ✅ СТВОРЕНО запис ${newRecord.id} для ${tgIdString}. Q#${questionNumber}, field="${fieldName}"`);
    }
  } catch (error) {
    console.error('[responseService] ❌ Помилка createOrUpdateResponse:', error);
    throw error;
  }
};

/**
 * Перевірка завершення сесії - перевіряємо affirmation поля
 */
export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    const tgIdString = String(tgId);

    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1
    }).firstPage();

    if (!records.length) return false;

    const completedField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
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
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${targetDate}")`,
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
      filterByFormula: `AND({TG_id}="${tgIdString}", IS_AFTER(DATESTR({Date Response}), "${sinceDateStr}"))`,
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