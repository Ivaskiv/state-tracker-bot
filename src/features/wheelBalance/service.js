// src/features/wheelBalance/service.js

import { getBase, tables } from '../../config/database.js';
import { addDays, toISODate as toISO, daysBetween } from '../../utils/helpers.js';
import { LIFE_SPHERES, WHEEL_QUESTIONS } from './constants.js';

const base = getBase();

export const FIELD_KEYS = Object.freeze({
  Health: 'Health',
  Health_Notes: 'Health_Notes',
  Self_Growth: 'Self_Growth',
  Self_Growth_Notes: 'Self_Growth_Notes',
  Relationships: 'Relationships',
  Relationships_Notes: 'Relationships_Notes',
  Career_Business: 'Career_Business',
  Career_Notes: 'Career_Notes',
  Finance: 'Finance',
  Finance_Notes: 'Finance_Notes',
  Rest_Leisure: 'Rest_Leisure',
  Leisure_Notes: 'Leisure_Notes',
  Spirituality: 'Spirituality',
  Spirituality_Notes: 'Spirituality_Notes',
  Housing: 'Housing',
  Housing_Notes: 'Housing_Notes',

  // службові
  TG_id: 'TG_id',
  User_Name: 'User_Name',
  Created_Date: 'Created_Date',
  Completed_Date: 'Completed_Date',
  Status: 'Status',
  Step: 'Step',
  Total_Score: 'Total_Score',
  AI_Analysis: 'AI_Analysis',
  UserLink: 'User', 
});

export const SCORE_FIELDS_ORDER = [
  FIELD_KEYS.Health,
  FIELD_KEYS.Self_Growth,
  FIELD_KEYS.Relationships,
  FIELD_KEYS.Career_Business,
  FIELD_KEYS.Finance,
  FIELD_KEYS.Rest_Leisure,
  FIELD_KEYS.Spirituality,
  FIELD_KEYS.Housing,
];

/** Нотатки у такому ж порядку */
export const NOTES_FIELDS_ORDER = [
  FIELD_KEYS.Health_Notes,
  FIELD_KEYS.Self_Growth_Notes,
  FIELD_KEYS.Relationships_Notes,
  FIELD_KEYS.Career_Notes,
  FIELD_KEYS.Finance_Notes,
  FIELD_KEYS.Leisure_Notes,
  FIELD_KEYS.Spirituality_Notes,
  FIELD_KEYS.Housing_Notes,
];

export const getQuestion = (_sphere, step) => {
  return WHEEL_QUESTIONS.wheel[step - 1] || {};
};

export const getProgressPercent = (step) => {
  const totalSteps = LIFE_SPHERES.length || 8;
  return Math.max(0, Math.min(100, Math.round((step / totalSteps) * 100)));
};

export const getProgressBar = (percent) => {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.floor(p / 10);
  const empty = 10 - filled;
  if (p === 0) return '░░░░░░░░░░ 0%';
  if (p === 100) return '██████████ 100%';
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${p}%`;
};

export const getActiveWheel = async (tgId) => {
  const recs = await base(tables.WHEEL_BALANCE)
    .select({
      filterByFormula: `AND({${FIELD_KEYS.TG_id}} = "${tgId}", {${FIELD_KEYS.Status}} = "In Progress")`,
      maxRecords: 1,
    })
    .firstPage();
  return recs[0] || null;
};

export const getLastCompletedWheel = async (tgId) => {
  const recs = await base(tables.WHEEL_BALANCE)
    .select({
      filterByFormula: `AND({${FIELD_KEYS.TG_id}} = "${tgId}", {${FIELD_KEYS.Status}} = "Completed")`,
      sort: [{ field: FIELD_KEYS.Completed_Date, direction: 'desc' }],
      maxRecords: 1,
      fields: [FIELD_KEYS.Completed_Date, FIELD_KEYS.Total_Score, FIELD_KEYS.Status],
    })
    .firstPage();
  return recs[0]?.fields || null;
};

/**
 * Перевірити, чи можна стартувати нове колесо:
 * - якщо існує "In Progress" → дозволяємо ПРОДОВЖИТИ (не створюємо нове)
 * - якщо останнє Completed <30 днів → заборона до nextDate
 * - інакше дозволено
 */
export const canStartWheel = async (tgId) => {
  const active = await getActiveWheel(tgId);
  if (active) return { allow: true, reason: 'continue_active', activeRecordId: active.id };

  const last = await getLastCompletedWheel(tgId);
  if (!last?.[FIELD_KEYS.Completed_Date]) return { allow: true, reason: 'no_completed_history' };

  const days = daysBetween(new Date(last[FIELD_KEYS.Completed_Date]), new Date());
  if (days < 30) {
    const nextDate = toISO(addDays(last[FIELD_KEYS.Completed_Date], 30));
    return { allow: false, reason: 'cooldown', nextDate };
  }
  return { allow: true, reason: 'cooldown_passed' };
};


const clamp01 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(10, Math.round(x)));
};

export const normalizeScoresFromFields = (fields = {}) => {
  return SCORE_FIELDS_ORDER.map((k) => clamp01(fields[k]));
};

export const scoresToFields = (scores = []) => {
  const out = {};
  SCORE_FIELDS_ORDER.forEach((k, i) => {
    out[k] = clamp01(scores[i] ?? 0);
  });
  return out;
};

export const notesToFields = (notes = []) => {
  const out = {};
  NOTES_FIELDS_ORDER.forEach((k, i) => {
    const v = notes[i];
    out[k] = v == null ? null : String(v).trim();
  });
  return out;
};

export const computeWheelStats = (scores = []) => {
  const arr = (scores || []).slice(0, 8).map((n) => clamp01(n));
  while (arr.length < 8) arr.push(0);
  const total = arr.reduce((s, v) => s + v, 0);
  const avg = +(total / 8).toFixed(1);

  const strong = [];
  const weak = [];
  for (let i = 0; i < 8; i++) {
    const label = String(LIFE_SPHERES[i]?.label || LIFE_SPHERES[i]?.key || `Сфера ${i + 1}`);
    const score = arr[i];
    if (score >= 8) strong.push({ name: label, score });
    if (score <= 5) weak.push({ name: label, score });
  }

  return { total, avg, strong, weak };
};


export const buildNewWheelPayload = ({ tgId, userName }) => {
  const today = toISO(new Date());
  return {
    [FIELD_KEYS.TG_id]: String(tgId),
    [FIELD_KEYS.User_Name]: userName || `User_${tgId}`,
    [FIELD_KEYS.Created_Date]: today,
    [FIELD_KEYS.Status]: 'In Progress',
    [FIELD_KEYS.Step]: 1,
    [FIELD_KEYS.Total_Score]: 0,
  };
};

/**
 * Поля для ЗАВЕРШЕННЯ запису (Completed)
 * @param {number[]} scores [8] оцінок 0..10
 * @param {string[]} notes  [8] нотаток (опц.)
 * @param {string} aiText   готовий текст аналізу (опц.)
 */
export const buildCompleteWheelPayload = ({ scores = [], notes = [], aiText = null }) => {
  const { total } = computeWheelStats(scores);
  const today = toISO(new Date());

  return {
    ...scoresToFields(scores),
    ...notesToFields(notes),
    [FIELD_KEYS.Completed_Date]: today,
    [FIELD_KEYS.Status]: 'Completed',
    [FIELD_KEYS.Step]: 8,
    [FIELD_KEYS.Total_Score]: total,
    [FIELD_KEYS.AI_Analysis]: aiText || null,
  };
};

export const wheelService = {
  getQuestion,
  getProgressPercent,
  getProgressBar,
  getActiveWheel,
  getLastCompletedWheel,
  canStartWheel,
  normalizeScoresFromFields,
  scoresToFields,
  notesToFields,
  computeWheelStats,
  buildNewWheelPayload,
  buildCompleteWheelPayload,
};

export default wheelService;

console.log('✅ [wheelBalance/service] Сервіс завантажено');
