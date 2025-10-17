// ========================================
// src/services/responses.js
// ========================================
import { getBase, tables, createRows, updateRows } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

export const getTodayResponses = async (tgId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id} = "${tgId}", DATESTR({Date_Response}) = "${today}")`,
        maxRecords: 1
      })
      .firstPage();

    return records[0] || null;
  } catch (error) {
    logger.error('[responses] ❌ Помилка getTodayResponses:', error);
    return null;
  }
};

export const getUserResponseHistory = async (tgId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];

    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id} = "${tgId}", {Date_Response} >= "${startStr}")`,
        sort: [{ field: 'Date_Response', direction: 'desc' }]
      })
      .all();

    return records;
  } catch (error) {
    logger.error('[responses] ❌ Помилка getUserResponseHistory:', error);
    return [];
  }
};

console.log('✅ [services/responses] Завантажено');
