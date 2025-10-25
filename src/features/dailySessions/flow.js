// src/features/dailySessions/flow.js

import logger from '../../utils/logger.js';
import { getBase, tables } from '../../config/database.js';
import { todayISO } from '../../utils/helpers.js';
import { EVENING_ORDER, MORNING_ORDER, QUESTIONS } from './constants.js';

const base = getBase();
const trim = (v, n) => String(v ?? '').slice(0, n);

export const getOrCreateTodayResponse = async (tgId) => {
  const iso = todayISO();
  const formula = `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${iso}")`;
  
  try {
    logger.info(`[daily] DEBUG query: ${formula}`);
    
    const recs = await base(tables.RESPONSES)
      .select({
        filterByFormula: formula,
        maxRecords: 1
      })
      .firstPage();

    if (recs.length > 0) {
      logger.info(`[daily] ✅ Запис знайдено: ${recs[0].id}`);
      return recs[0];
    }

    logger.info(`[daily] 📝 CREATE для ${tgId} на ${iso}`);
    const [created] = await base(tables.RESPONSES).create([{
      fields: {
        TG_id: String(tgId),
        Date_Response: iso,
        Current_Activity: null
      }
    }], { typecast: true });

    logger.info(`[daily] ✅ Новий: ${created.id}`);
    return created;

  } catch (error) {
    logger.error('[daily/getOrCreateTodayResponse]', error);
    throw error;
  }
};

export const getTodayResponseOrNull = async (tgId) => {
  const iso = todayISO();
  const recs = await base(tables.RESPONSES)
    .select({
      filterByFormula: `AND({TG_id}="${tgId}", {Date_Response}="${iso}")`,
      maxRecords: 1
    })
    .firstPage();
  return recs[0] || null;
};

// ════════════════════════════════════════════════════════════
// 👤 USER & STATUS HELPERS
// ════════════════════════════════════════════════════════════

export const getUserRecord = async (tgId) => {
  const recs = await base(tables.USERS)
    .select({
      filterByFormula: `{TG_id}="${tgId}"`,
      maxRecords: 1
    })
    .firstPage();
  return recs[0] || null;
};

/**
 * ✅ Set Current_Activity to FIELD NAME
 * Examples: 'Daily_Focus', 'Q_m_1', 'Q_m_2', 'Q_m_3', etc.
 * Special: 'morning_completed', 'morning_pending', 'evening_completed', etc.
 */
export const setResponsesCurrentActivity = async (respId, value) => {
  try {
    await base(tables.RESPONSES).update(respId, { Current_Activity: value });
    logger.info(`[daily] Current_Activity set to: ${value}`);
  } catch (e) {
    logger.warn('[daily] setResponsesCurrentActivity:', e.message);
  }
};

export const setUserAnswerStep = async (userRec, step) => {
  try {
    if (userRec) await base(tables.USERS).update(userRec.id, { Answer_Step: step ?? null });
  } catch (e) {
    logger.warn('[daily] setUserAnswerStep:', e.message);
  }
};

// ════════════════════════════════════════════════════════════
// 🌞 MORNING HELPERS
// ════════════════════════════════════════════════════════════

export const morningStarted = (fields = {}) => {
  if (fields.Daily_Focus && String(fields.Daily_Focus).trim() !== '') return true;
  return MORNING_ORDER.slice(1).some(f => {
    const v = fields[f];
    return v && String(v).trim() !== '';
  });
};

/**
 * Get next incomplete morning field
 * Returns: 'Daily_Focus', 'Q_m_1', 'Q_m_2', etc.
 * Returns: null if all completed
 */
export const getNextMorningField = (fields) => {
  for (const f of MORNING_ORDER) {
    const v = fields?.[f];
    if (v === undefined || v === null || String(v).trim() === '') return f;
  }
  return null;  // All fields completed
};

export const clearMorningFields = async (respId) => {
  const patch = {};
  MORNING_ORDER.forEach(f => patch[f] = null);
  await base(tables.RESPONSES).update(respId, patch);
  logger.info(`[daily] Morning fields cleared for ${respId}`);
};

// ════════════════════════════════════════════════════════════
// 🌙 EVENING HELPERS
// ════════════════════════════════════════════════════════════

export const eveningStarted = (fields = {}) =>
  EVENING_ORDER.some(f => {
    const v = fields[f];
    return v && String(v).trim() !== '';
  });

/**
 * Get next incomplete evening field
 * Returns: 'Q_e_1', 'Q_e_2', etc.
 * Returns: null if all completed
 */
export const getNextEveningField = (fields = {}) => {
  for (const f of EVENING_ORDER) {
    const v = fields[f];
    if (!v || String(v).trim() === '') return f;
  }
  return null;  // All fields completed
};

export const clearEveningFields = async (respId) => {
  const patch = {};
  EVENING_ORDER.forEach(f => patch[f] = null);
  await base(tables.RESPONSES).update(respId, patch);
  logger.info(`[daily] Evening fields cleared for ${respId}`);
};

// ════════════════════════════════════════════════════════════
// 🔄 FIELD ⇄ AWAITING MAPPING
// ════════════════════════════════════════════════════════════

/**
 * Convert field name to session awaiting state
 * 'Daily_Focus' → 'focus'
 * 'Q_m_1' → 'q_m_1'
 */
export const fieldToAwaiting = (field) => {
  if (field === 'Daily_Focus') return 'focus';
  return field.toLowerCase();
};

/**
 * Convert session awaiting state to field name
 * 'focus' → 'Daily_Focus'
 * 'q_m_1' → 'Q_m_1'
 */
export const awaitingToField = (awaiting) => {
  if (awaiting === 'focus') return 'Daily_Focus';
  return awaiting.replace(/^q_m_/, 'Q_m_').replace(/^q_e_/, 'Q_e_');
};

// ════════════════════════════════════════════════════════════
// 💬 QUESTION HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Get question object for a field
 * Returns: { text, hint, field }
 */
export const questionForField = (field) => {
  if (field === 'Daily_Focus') {
    return {
      text: 'Скажи: *Який фокус на сьогодні?*',
      hint: 'Коротко одним-двома реченнями про головний намір дня.',
      field: 'Daily_Focus'
    };
  }
  const isMorning = field.startsWith('Q_m_');
  const idx = Number(field.split('_')[2]) - 1;
  return isMorning ? QUESTIONS.morning[idx] : QUESTIONS.evening[idx];
};

// ════════════════════════════════════════════════════════════
// 💾 SAVE ANSWERS
// ════════════════════════════════════════════════════════════

/**
 * Save morning answer and get next field
 * Returns: { nextField, rec }
 */
export const saveMorningAnswer = async (tgId, field, value) => {
  const rec = await getOrCreateTodayResponse(tgId);
  const trimmedValue = 
    field === 'Daily_Focus' ? trim(value, 500) :
    field.startsWith('Q_m_') ? trim(value, 2000) : trim(value, 1000);
  
  await base(tables.RESPONSES).update(rec.id, { [field]: trimmedValue });
  logger.info(`[daily] Saved ${field} for ${tgId}`);
  
  const fresh = await base(tables.RESPONSES).find(rec.id);
  const nextField = getNextMorningField(fresh.fields);
  
  return { nextField, rec: fresh };
};

/**
 * Save evening answer and get next field
 * Returns: { nextField, rec }
 */
export const saveEveningAnswer = async (tgId, field, value) => {
  const rec = await getOrCreateTodayResponse(tgId);
  const trimmedValue = trim(value, 1000);
  
  await base(tables.RESPONSES).update(rec.id, { [field]: trimmedValue });
  logger.info(`[daily] Saved ${field} for ${tgId}`);
  
  const fresh = await base(tables.RESPONSES).find(rec.id);
  const nextField = getNextEveningField(fresh.fields);
  
  return { nextField, rec: fresh };
};

// ════════════════════════════════════════════════════════════
// 📊 STATE CHECKS
// ════════════════════════════════════════════════════════════

/**
 * Get morning session state
 * Returns: { status: 'not_started'|'in_progress'|'completed', rec, nextField? }
 */
export const getMorningState = async (tgId) => {
  const todayRec = await getOrCreateTodayResponse(tgId);

  if (!morningStarted(todayRec.fields)) {
    return { status: 'not_started', rec: todayRec };
  }

  const nextField = getNextMorningField(todayRec.fields);
  if (!nextField) {
    return { status: 'completed', rec: todayRec };
  }

  return { status: 'in_progress', rec: todayRec, nextField };
};

/**
 * Get evening session state
 * Returns: { status: 'not_started'|'in_progress'|'completed', rec, nextField? }
 */
export const getEveningState = async (tgId) => {
  const rec = await getOrCreateTodayResponse(tgId);

  if (!eveningStarted(rec.fields)) {
    return { status: 'not_started', rec };
  }

  const nextField = getNextEveningField(rec.fields);
  if (!nextField) {
    return { status: 'completed', rec };
  }

  return { status: 'in_progress', rec, nextField };
};

// ════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ════════════════════════════════════════════════════════════

export default {
  getOrCreateTodayResponse,
  getTodayResponseOrNull,
  getUserRecord,
  setResponsesCurrentActivity,
  setUserAnswerStep,
  morningStarted,
  getNextMorningField,
  clearMorningFields,
  eveningStarted,
  getNextEveningField,
  clearEveningFields,
  fieldToAwaiting,
  awaitingToField,
  questionForField,
  saveMorningAnswer,
  saveEveningAnswer,
  getMorningState,
  getEveningState
};

console.log('✅ [dailySessions/flow] ONE RECORD PER DAY - Current_Activity as field name')