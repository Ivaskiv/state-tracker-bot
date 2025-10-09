// src/services/responseService.js

import { getBase, tables } from '../config/database.js';
import userService from './userService.js';
import dataSyncService from './dataSyncService.js';
import { QUESTION_PARSERS, ANSWER_STEPS } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

// ========== HELPERS (стрілочні) ==========
const _getTodayRecord = async (tgId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    logger.info(`[responseService] 🔍 _getTodayRecord for ${tgId}: ${records.length ? 'found' : 'not found'}`);
    return records[0] || null;
  } catch (error) {
    logger.error('[responseService] ❌ _getTodayRecord error:', error);
    throw error;
  }
};

const _createOrUpdateRecord = async (tgId, fields) => {
  try {
    let record = await _getTodayRecord(tgId);

    if (!record) {
      const user = await userService.getUserByTgId(tgId);
      const created = await base(tables.RESPONSES).create([{
        fields: {
          TG_id: String(tgId),
          Date_Response: new Date().toISOString().split('T')[0],
          'User Name': user?.['User Name'] || 'Користувач',
          ...fields
        }
      }]);
      record = created[0];
      logger.info(`[responseService] 📝 Created new record for ${tgId}`);
    } else {
      // оновлюємо існуючий
      const updated = await base(tables.RESPONSES).update(record.id, fields);
      // airtable повертає оновлений запис — присвоюємо для консистентності
      record = updated;
      logger.info(`[responseService] 🔄 Updated record for ${tgId}`);
    }

    return record;
  } catch (error) {
    logger.error('[responseService] ❌ _createOrUpdateRecord error:', error);
    throw error;
  }
};

// ========== PARSERS ==========
const _parseMorningAnswer = (qNum, answer) => {
  try {
    switch (qNum) {
      case 3: return QUESTION_PARSERS?.parseGoals?.(answer) || {};
      case 4: return QUESTION_PARSERS?.parseDailyFocus?.(answer) || {};
      case 5: return QUESTION_PARSERS?.parseState?.(answer) || {};
      case 6: {
        const parsed = QUESTION_PARSERS?.parseActions?.(answer) || {};
        // якщо парсер віддає affirmation — перемістимо в affirmation_m
        return parsed.affirmation ? { affirmation_m: parsed.affirmation } : parsed;
      }
      default: return {};
    }
  } catch (error) {
    logger.error(`[responseService] ❌ _parseMorningAnswer Q${qNum}:`, error);
    return {};
  }
};

const _parseEveningAnswer = (qNum, answer, todayData) => {
  try {
    if (qNum === 5) return analyzeActionCompletion(answer || '', todayData || {});
    if (qNum === 6) return analyzeGoalProgress(answer || '');
    return {};
  } catch (error) {
    logger.error(`[responseService] ❌ _parseEveningAnswer Q${qNum}:`, error);
    return {};
  }
};

// ========== SAVE / CHECK ==========
const saveMorningAnswer = async (tgId, qNum, answer) => {
  try {
    const field = `Q_m_${qNum}`;
    const nextStep = qNum < 6 ? `Q_m_${qNum + 1}` : 'affirmation_m';

    const fields = { [field]: answer, Current_Activity: nextStep };
    Object.assign(fields, _parseMorningAnswer(qNum, answer));

    await _createOrUpdateRecord(tgId, fields);
    await userService.updateUserFields(tgId, { ANSWER_STEPS: nextStep, Last_Activity: new Date().toISOString() });

    logger.info(`[responseService] ✅ Morning Q${qNum} saved for ${tgId}, next: ${nextStep}`);
  } catch (error) {
    logger.error('[responseService] ❌ saveMorningAnswer error:', error);
    throw error;
  }
};

const saveMorningAffirmation = async (tgId, affirmation) => {
  try {
    const record = await _getTodayRecord(tgId);
    if (!record) throw new Error('Responses not found');

    const fields = { affirmation_m: affirmation, Current_Activity: 'morning_completed' };
    await base(tables.RESPONSES).update(record.id, fields);
    await userService.updateUserFields(tgId, { ANSWER_STEPS: 'morning_completed', Last_Activity: new Date().toISOString() });

    try { await dataSyncService.syncMorningData(tgId); } catch (e) { logger.error('[responseService] syncMorningData error:', e); }

    logger.info(`[responseService] ✅ Morning affirmation saved for ${tgId}`);
  } catch (error) {
    logger.error('[responseService] ❌ saveMorningAffirmation error:', error);
    throw error;
  }
};

const isMorningCompleted = async (tgId) => {
  try {
    const record = await _getTodayRecord(tgId);
    if (!record) return false;
    // врахувати Q_m_6 або affirmation_m (за ТЗ)
    return !!record.fields?.Q_m_6 || !!record.fields?.affirmation_m;
  } catch (error) {
    logger.error('[responseService] ❌ isMorningCompleted error:', error);
    return false;
  }
};

// ========== EVENING ==========
const saveEveningAnswer = async (tgId, qNum, answer) => {
  try {
    const record = await _getTodayRecord(tgId);
    const todayData = record?.fields || {};
    const field = `Q_e_${qNum}`;
    const nextStep = qNum < 7 ? `Q_e_${qNum + 1}` : 'affirmation_e';

    const fields = { [field]: answer, Current_Activity: nextStep };
    Object.assign(fields, _parseEveningAnswer(qNum, answer, todayData));

    await _createOrUpdateRecord(tgId, fields);
    await userService.updateUserFields(tgId, { ANSWER_STEPS: nextStep, Last_Activity: new Date().toISOString() });

    logger.info(`[responseService] ✅ Evening Q${qNum} saved for ${tgId}, next: ${nextStep}`);
  } catch (error) {
    logger.error('[responseService] ❌ saveEveningAnswer error:', error);
    throw error;
  }
};

const saveEveningAffirmation = async (tgId, affirmation) => {
  try {
    const record = await _getTodayRecord(tgId);
    if (!record) throw new Error('Responses not found');

    const fields = { affirmation_e: affirmation, Current_Activity: 'evening_completed' };
    await base(tables.RESPONSES).update(record.id, fields);
    await userService.updateUserFields(tgId, { ANSWER_STEPS: 'evening_completed', Last_Activity: new Date().toISOString() });

    try { await dataSyncService.syncEveningData(tgId); } catch (e) { logger.error('[responseService] syncEveningData error:', e); }

    logger.info(`[responseService] ✅ Evening affirmation saved for ${tgId}`);
  } catch (error) {
    logger.error('[responseService] ❌ saveEveningAffirmation error:', error);
    throw error;
  }
};

const isEveningCompleted = async (tgId) => {
  try {
    const record = await _getTodayRecord(tgId);
    if (!record) return false;
    return record.fields?.Current_Activity === 'evening_completed' || !!record.fields?.Q_e_7;
  } catch (error) {
    logger.error('[responseService] ❌ isEveningCompleted error:', error);
    return false;
  }
};

// ========== ANALYSIS HELPERS ==========
const analyzeActionCompletion = (answer, todayData) => {
  try {
    const lower = (answer || '').toLowerCase();
    const actions = [todayData?.Daily_Action_1, todayData?.Daily_Action_2, todayData?.Daily_Action_3].filter(Boolean);
    const completed = [];
    const skipped = [];
    const doneMarkers = ['✅','зроблено','виконано','так','+','done'];
    const skipMarkers = ['⏭','не зроблено','ні','-','пропустила','пропустив'];

    actions.forEach((act, i) => {
      const l = (act || '').toLowerCase().slice(0, 40); // короткий фрагмент для пошуку
      const matchedDone = doneMarkers.some(m => lower.includes(m) && lower.includes(l.slice(0,10)));
      const matchedSkip = skipMarkers.some(m => lower.includes(m) && lower.includes(l.slice(0,10)));
      if (matchedDone) completed.push(i + 1);
      else if (matchedSkip) skipped.push(i + 1);
    });

    return {
      Actions_Completed_Count: completed.length || null,
      Actions_Completed_List: completed.length ? completed.join(',') : null,
      Actions_Skipped_List: skipped.length ? skipped.join(',') : null,
      Completion_Rate: actions.length ? Math.round((completed.length / actions.length) * 100) : null
    };
  } catch (error) {
    logger.error('[responseService] ❌ analyzeActionCompletion error:', error);
    return {};
  }
};

const analyzeGoalProgress = (answer) => {
  try {
    return { Goal_Progress: answer || null };
  } catch (error) {
    logger.error('[responseService] ❌ analyzeGoalProgress error:', error);
    return {};
  }
};

// ========== RESET ==========
const resetSession = async (tgId, type) => {
  try {
    const record = await _getTodayRecord(tgId);
    if (!record) return;

    const fieldsToReset = {};

    if (type === 'morning') {
      for (let i = 1; i <= 6; i++) fieldsToReset[`Q_m_${i}`] = null;
      fieldsToReset.affirmation_m = null;
      fieldsToReset.Current_Activity = ANSWER_STEPS?.MORNING_1 || 'Q_m_1';
    } else {
      for (let i = 1; i <= 7; i++) fieldsToReset[`Q_e_${i}`] = null;
      fieldsToReset.affirmation_e = null;
      fieldsToReset.Actions_Completed_Count = null;
      fieldsToReset.Actions_Completed_List = null;
      fieldsToReset.Actions_Skipped_List = null;
      fieldsToReset.Completion_Rate = null;
      fieldsToReset.Current_Activity = ANSWER_STEPS?.EVENING_1 || 'Q_e_1';
    }

    await _createOrUpdateRecord(tgId, fieldsToReset);
    await userService.updateUserFields(tgId, { ANSWER_STEPS: fieldsToReset.Current_Activity, Last_Activity: new Date().toISOString() });
    logger.info(`[responseService] 🔄 Session reset (${type}) for ${tgId}`);
  } catch (error) {
    logger.error('[responseService] ❌ resetSession error:', error);
    throw error;
  }
};

// ========== SYNC WRAPPERS ==========
const syncMorningResponses = async (tgId) => {
  try {
    const result = await dataSyncService.syncMorningData(tgId);
    logger.info(`[responseService] ✅ syncMorningResponses for ${tgId}: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error('[responseService] ❌ syncMorningResponses error:', error);
    throw error;
  }
};

const syncEveningResponses = async (tgId) => {
  try {
    const result = await dataSyncService.syncEveningData(tgId);
    logger.info(`[responseService] ✅ syncEveningResponses for ${tgId}: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error('[responseService] ❌ syncEveningResponses error:', error);
    throw error;
  }
};

// ========== EXPORT ==========
const responseService = {
  _getTodayRecord,
  _createOrUpdateRecord,
  _parseMorningAnswer,
  _parseEveningAnswer,
  saveMorningAnswer,
  saveMorningAffirmation,
  isMorningCompleted,
  saveEveningAnswer,
  saveEveningAffirmation,
  isEveningCompleted,
  analyzeActionCompletion,
  analyzeGoalProgress,
  resetSession,
  syncMorningResponses,
  syncEveningResponses
};

export default responseService;
