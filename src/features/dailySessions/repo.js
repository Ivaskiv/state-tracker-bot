// src/services/dailySessions/repo.js
// Repository-шар для dailySessions (Airtable)

import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();
const logPfx = '[daily/repo]';

// ── helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);

const sanitizeText = (text) => {
  if (!text) return '';
  const maxLength = 50000; // запас до ліміту Airtable Long Text
  let s = String(text).trim();
  if (s.length > maxLength) s = s.slice(0, maxLength) + '...';
  // приберемо control chars
  return s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '');
};

// ── CRUD сьогоднішнього запису ────────────────────────────────────────────────
export const getTodayRecord = async (tgId) => {
  try {
    const today = todayStr();
    const rows = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1,
      })
      .firstPage();
    return rows?.[0] || null;
  } catch (error) {
    logger.error(`${logPfx} getTodayRecord ❌`, error?.message || error);
    throw error;
  }
};

export const createTodayRecord = async (tgId, userName) => {
  try {
    const [record] = await base(tables.RESPONSES).create(
      [{
        fields: {
          TG_id: String(tgId),
          'User Name': userName || 'Користувач',
          Date_Response: todayStr(),
        },
      }],
      { typecast: true }
    );
    logger.info(`${logPfx} createTodayRecord ✅ tg=${tgId}`);
    return record;
  } catch (error) {
    logger.error(`${logPfx} createTodayRecord ❌`, error?.message || error);
    throw error;
  }
};

export const ensureTodayRecord = async (tgId, userName) => {
  try {
    return (await getTodayRecord(tgId)) || (await createTodayRecord(tgId, userName));
  } catch (error) {
    logger.error(`${logPfx} ensureTodayRecord ❌`, error?.message || error);
    throw error;
  }
};

// ── статуси сесій ────────────────────────────────────────────────────────────
export const isMorningCompleted = async (tgId) => {
  try {
    const rec = await getTodayRecord(tgId);
    return !!rec?.fields?.Q_m_6;
  } catch (error) {
    logger.error(`${logPfx} isMorningCompleted ❌`, error?.message || error);
    return false;
  }
};

export const isEveningCompleted = async (tgId) => {
  try {
    const rec = await getTodayRecord(tgId);
    return !!rec?.fields?.Q_e_7;
  } catch (error) {
    logger.error(`${logPfx} isEveningCompleted ❌`, error?.message || error);
    return false;
  }
};

// ── скидання сесії ───────────────────────────────────────────────────────────
export const resetSession = async (tgId, sessionType) => {
  try {
    const fields = { Current_Activity: null };
    if (sessionType === 'morning') {
      for (let i = 1; i <= 6; i++) fields[`Q_m_${i}`] = null;
    } else {
      for (let i = 1; i <= 7; i++) fields[`Q_e_${i}`] = null;
    }
    await updateTodayRecord(tgId, fields);
    logger.info(`${logPfx} resetSession ✅ ${sessionType} tg=${tgId}`);
  } catch (error) {
    logger.error(`${logPfx} resetSession ❌`, error?.message || error);
    throw error;
  }
};

// ── історія ──────────────────────────────────────────────────────────────────
export const getRecentRecords = async (tgId, days = 7) => {
  try {
    const rows = await base(tables.RESPONSES)
      .select({
        filterByFormula: `{TG_id}="${tgId}"`,
        sort: [{ field: 'Date_Response', direction: 'desc' }],
        maxRecords: days,
      })
      .firstPage();
    return rows || [];
  } catch (error) {
    logger.error(`${logPfx} getRecentRecords ❌`, error?.message || error);
    return [];
  }
};

// ── оновлення “сьогодні” з авто-санітизацією ─────────────────────────────────
export const updateTodayRecord = async (tgId, fields) => {
  try {
    const rec = await getTodayRecord(tgId);
    if (!rec) {
      logger.error(`${logPfx} updateTodayRecord ❌ запис не знайдено tg=${tgId}`);
      return null;
    }

    const cleaned = {};
    for (const [k, v] of Object.entries(fields)) {
      cleaned[k] = typeof v === 'string' ? sanitizeText(v) : v;
    }

    logger.info(`${logPfx} updateTodayRecord 🔄 id=${rec.id}`);
    await base(tables.RESPONSES).update(rec.id, cleaned, { typecast: true });
    logger.info(`${logPfx} updateTodayRecord ✅`);
    return true;
  } catch (error) {
    logger.error(`${logPfx} updateTodayRecord ❌`, {
      message: error?.message,
      statusCode: error?.statusCode,
    });
    throw error;
  }
};
