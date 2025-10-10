// src/services/dailySessions/database.js
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const getTodayRecord = async (tgId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    logger.error('❌ [dailySessions] getTodayRecord:', error);
    throw error;
  }
};

export const createTodayRecord = async (tgId, userName) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [record] = await base(tables.RESPONSES).create([{
      fields: {
        TG_id: String(tgId),
        'User Name': userName || 'Користувач',
        Date_Response: today
      }
    }], { typecast: true });
    
    logger.info(`✅ [dailySessions] Створено запис для ${tgId}`);
    return record;
  } catch (error) {
    logger.error('❌ [dailySessions] createTodayRecord:', error);
    throw error;
  }
};

export const updateTodayRecord = async (tgId, fields) => {
  try {
    const record = await getTodayRecord(tgId);
    
    if (!record) {
      logger.error('❌ [dailySessions] Запис не знайдено');
      return null;
    }
    
    await base(tables.RESPONSES).update(record.id, fields, { typecast: true });
    return true;
  } catch (error) {
    logger.error('❌ [dailySessions] updateTodayRecord:', error);
    throw error;
  }
};

export const ensureTodayRecord = async (tgId, userName) => {
  try {
    let record = await getTodayRecord(tgId);
    
    if (!record) {
      record = await createTodayRecord(tgId, userName);
    }
    
    return record;
  } catch (error) {
    logger.error('❌ [dailySessions] ensureTodayRecord:', error);
    throw error;
  }
};

export const isMorningCompleted = async (tgId) => {
  try {
    const record = await getTodayRecord(tgId);
    return record && !!record.fields.Q_m_6;
  } catch (error) {
    logger.error('❌ [dailySessions] isMorningCompleted:', error);
    return false;
  }
};

export const isEveningCompleted = async (tgId) => {
  try {
    const record = await getTodayRecord(tgId);
    return record && !!record.fields.Q_e_7;
  } catch (error) {
    logger.error('❌ [dailySessions] isEveningCompleted:', error);
    return false;
  }
};

export const resetSession = async (tgId, sessionType) => {
  try {
    const fields = {};
    
    if (sessionType === 'morning') {
      for (let i = 1; i <= 6; i++) fields[`Q_m_${i}`] = null;
    } else {
      for (let i = 1; i <= 7; i++) fields[`Q_e_${i}`] = null;
    }
    
    fields.Current_Activity = null;
    
    await updateTodayRecord(tgId, fields);
    logger.info(`✅ [dailySessions] Скинуто ${sessionType} для ${tgId}`);
  } catch (error) {
    logger.error('❌ [dailySessions] resetSession:', error);
    throw error;
  }
};

export const getRecentRecords = async (tgId, days = 7) => {
  try {
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `{TG_id}="${tgId}"`,
        sort: [{ field: 'Date_Response', direction: 'desc' }],
        maxRecords: days
      })
      .firstPage();
    
    return records;
  } catch (error) {
    logger.error('❌ [dailySessions] getRecentRecords:', error);
    return [];
  }
};