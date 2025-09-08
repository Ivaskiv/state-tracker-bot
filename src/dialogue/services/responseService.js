// src/dialogue/services/responseService.js
import { getBase } from '../../config/database.js';
import { QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS, ANSWER_STEPS } from '../../config/constants.js';
import { getUserDateString, getUserDateTime } from '../../utils/timezoneUtils.js';

export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType,
  answerStep,
  questionNumber,
  answer,
  fieldName,
  isCompleted = false
) => {
  try {
    const base = getBase();
    const today = getUserDateString(tgId); // Використовуємо timezone користувача
    const tgIdString = String(tgId);

    const existingRecords = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1
    }).firstPage();

    const fieldsToUpdate = {
      'Answer_Step': answerStep,
      'Date Response': getUserDateTime(tgId) // Зберігаємо з timezone користувача
    };

    const maxMorningQuestions = MORNING_QUESTIONS.length;
    const maxEveningQuestions = EVENING_QUESTIONS.length;

    if (questionType === QUESTION_TYPES.MORNING) {
      if (answerStep === ANSWER_STEPS.AFFIRMATION_MORNING || answerStep === 'affirmation_m') {
        fieldsToUpdate['affirmation_m'] = answer;
      } else {
        fieldsToUpdate[fieldName] = answer;
      }
    }

    if (questionType === QUESTION_TYPES.EVENING) {
      if (answerStep === ANSWER_STEPS.AFFIRMATION_EVENING || answerStep === 'affirmation_e') {
        fieldsToUpdate['affirmation_e'] = answer;
      } else {
        fieldsToUpdate[fieldName] = answer;
      }
    }

    if (existingRecords.length > 0) {
      const recordId = existingRecords[0].id;
      await base('Responses').update([{ 
        id: recordId,
        fields: fieldsToUpdate 
      }]);
      console.log(`[responseService] ✅ ОНОВЛЕНО запис ${recordId} для ${tgIdString}. Q#${questionNumber}, field="${fieldName}"`);
    } else {
      const newRecordFields = {
        'TG_id': tgIdString,
        'User Name': userName,
        'Date Response': getUserDateTime(tgId),
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

export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const base = getBase();
    const today = getUserDateString(tgId);
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

export const getDayRecord = async (tgId, date = null) => {
  try {
    const base = getBase();
    const targetDate = date || getUserDateString(tgId);
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