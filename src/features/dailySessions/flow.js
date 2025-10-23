// src/features/dailySessions/flow.js
import logger from '../../utils/logger.js';
import { getBase, tables } from '../../config/database.js';
import { todayISO } from '../../utils/helpers.js';
import { ANSWER_STEPS, CURRENT_ACTIVITY as CA } from '../../config/constantsStatuses.js';
import { QUESTIONS } from './constantsQuestions.js';

const base = getBase();

const MORNING_ORDER = ['Daily_Focus','Q_m_1','Q_m_2','Q_m_3','Q_m_4','Q_m_5','Q_m_6'];
const EVENING_ORDER = ['Q_e_1','Q_e_2','Q_e_3','Q_e_4','Q_e_5','Q_e_6','Q_e_7'];

const trim = (v, n) => String(v ?? '').slice(0, n);

// ════════════════════════════════════════════════════════════
// DB HELPERS
// ════════════════════════════════════════════════════════════

export const getOrCreateTodayResponse = async (tgId) => {
  const iso = todayISO();
  const recs = await base(tables.RESPONSES)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", {Date_Response}="${iso}")`, maxRecords: 1 })
    .firstPage();
  if (recs.length) return recs[0];
  const [created] = await base(tables.RESPONSES).create([
    { fields: { TG_id: String(tgId), Date_Response: iso } }
  ]);
  return created;
};

export const getTodayResponseOrNull = async (tgId) => {
  const iso = todayISO();
  const recs = await base(tables.RESPONSES)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", {Date_Response}="${iso}")`, maxRecords: 1 })
    .firstPage();
  return recs[0] || null;
};

export const createTodayResponse = async (tgId) => {
  const [created] = await base(tables.RESPONSES).create([
    { fields: { TG_id: String(tgId), Date_Response: todayISO() } }
  ]);
  return created;
};

export const getUserRecord = async (tgId) => {
  const recs = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}="${tgId}"`, maxRecords: 1 })
    .firstPage();
  return recs[0] || null;
};

export const setResponsesCurrentActivity = async (respId, value) => {
  try {
    await base(tables.RESPONSES).update(respId, { Current_Activity: value });
  } catch (e) {
    logger.warn('[daily/flow] setResponsesCurrentActivity:', e.message);
  }
};

export const setUserAnswerStep = async (userRec, step) => {
  try {
    if (userRec) await base(tables.USERS).update(userRec.id, { Answer_Step: step ?? null });
  } catch (e) {
    logger.warn('[daily/flow] setUserAnswerStep:', e.message);
  }
};

// ════════════════════════════════════════════════════════════
// MORNING HELPERS
// ════════════════════════════════════════════════════════════

export const morningStarted = (fields = {}) => {
  if (fields.Daily_Focus && String(fields.Daily_Focus).trim() !== '') return true;
  return MORNING_ORDER.slice(1).some(f => {
    const v = fields[f]; return v && String(v).trim() !== '';
  });
};

export const getNextMorningField = (fields) => {
  for (const f of MORNING_ORDER) {
    const v = fields?.[f];
    if (v === undefined || v === null || String(v).trim() === '') return f;
  }
  return null;
};

export const clearMorningFields = async (respId) => {
  const patch = {};
  MORNING_ORDER.forEach(f => patch[f] = null);
  await base(tables.RESPONSES).update(respId, patch);
};

// ════════════════════════════════════════════════════════════
// EVENING HELPERS
// ════════════════════════════════════════════════════════════

export const eveningStarted = (fields = {}) =>
  EVENING_ORDER.some(f => {
    const v = fields[f]; return v && String(v).trim() !== '';
  });

export const getNextEveningField = (fields = {}) => {
  for (const f of EVENING_ORDER) {
    const v = fields[f];
    if (!v || String(v).trim() === '') return f;
  }
  return null;
};

export const clearEveningFields = async (respId) => {
  const patch = {};
  EVENING_ORDER.forEach(f => patch[f] = null);
  await base(tables.RESPONSES).update(respId, patch);
};

// ════════════════════════════════════════════════════════════
// FIELD ⇄ AWAITING MAPPING
// ════════════════════════════════════════════════════════════

export const fieldToAwaiting = (field) => (field === 'Daily_Focus' ? 'focus' : field.toLowerCase());

export const awaitingToField = (awaiting) => {
  if (awaiting === 'focus') return 'Daily_Focus';
  return awaiting.replace(/^q_m_/, 'Q_m_').replace(/^q_e_/, 'Q_e_');
};

// ════════════════════════════════════════════════════════════
// QUESTION HELPERS
// ════════════════════════════════════════════════════════════

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
// STATE MANAGEMENT
// ════════════════════════════════════════════════════════════

export const saveMorningAnswer = async (tgId, field, value) => {
  const rec = await getOrCreateTodayResponse(tgId);
  const trimmedValue = 
    field === 'Daily_Focus' ? trim(value, 500) :
    field.startsWith('Q_m_') ? trim(value, 2000) : trim(value, 1000);
  
  await base(tables.RESPONSES).update(rec.id, { [field]: trimmedValue });
  
  const fresh = await base(tables.RESPONSES).find(rec.id);
  const nextField = getNextMorningField(fresh.fields);
  
  return { nextField, rec: fresh };
};

export const saveEveningAnswer = async (tgId, field, value) => {
  const rec = await getOrCreateTodayResponse(tgId);
  const trimmedValue = trim(value, 1000);
  
  await base(tables.RESPONSES).update(rec.id, { [field]: trimmedValue });
  
  const fresh = await base(tables.RESPONSES).find(rec.id);
  const nextField = getNextEveningField(fresh.fields);
  
  return { nextField, rec: fresh };
};

// ════════════════════════════════════════════════════════════
// MORNING STATE CHECKS
// ════════════════════════════════════════════════════════════

export const getMorningState = async (tgId) => {
  const todayRec = await getTodayResponseOrNull(tgId);

  if (!todayRec) {
    return { status: 'not_created' };
  }

  if (!morningStarted(todayRec.fields)) {
    return { status: 'not_started', rec: todayRec };
  }

  const nextField = getNextMorningField(todayRec.fields);
  if (!nextField) {
    return { status: 'completed', rec: todayRec };
  }

  return { status: 'in_progress', rec: todayRec, nextField };
};

export const getEveningState = async (tgId) => {
  const todayRec = await getTodayResponseOrNull(tgId);
  const rec = todayRec || await createTodayResponse(tgId);

  if (!eveningStarted(rec.fields)) {
    return { status: 'not_started', rec };
  }

  const nextField = getNextEveningField(rec.fields);
  if (!nextField) {
    return { status: 'completed', rec };
  }

  return { status: 'in_progress', rec, nextField };
};

export default {
  // DB
  getOrCreateTodayResponse, getTodayResponseOrNull, createTodayResponse,
  getUserRecord, setResponsesCurrentActivity, setUserAnswerStep,
  // Morning
  morningStarted, getNextMorningField, clearMorningFields,
  // Evening
  eveningStarted, getNextEveningField, clearEveningFields,
  // Mapping
  fieldToAwaiting, awaitingToField,
  // Questions
  questionForField,
  // State
  saveMorningAnswer, saveEveningAnswer,
  getMorningState, getEveningState
};