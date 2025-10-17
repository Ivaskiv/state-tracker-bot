// src/features/wheelBalance/database.js
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { todayISO } from '../../utils/date.js';

const base = getBase();

export const getActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="In Progress")`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка getActiveWheel:', error);
    throw error;
  }
};

export const getLatestCompletedWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        sort: [{ field: 'Completed_Date', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка getLatestCompletedWheel:', error);
    return null;
  }
};

export const cancelActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", {Status}="In Progress")` })
      .all();

    if (records.length > 0) {
      await base(tables.WHEEL_BALANCE).update(
        records.map(r => ({ id: r.id, fields: { Status: 'Incomplete' } }))
      );
      logger.info(`✅ [wheelBalance] Скасовано ${records.length} коліс для ${tgId}`);
    }
    
    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка cancelActiveWheel:', error);
    throw error;
  }
};

export const getUserWheelStats = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .all();
    
    return {
      total: records.length,
      lastScore: records[0]?.fields.Total_Score ?? null,
      lastDate: records[0]?.fields.Completed_Date ?? null,
      records: records.map(r => r.fields)
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка getUserWheelStats:', error);
    return { total: 0, lastScore: null, lastDate: null, records: [] };
  }
};

export const createWheel = async (tgId, userName) => {
  try {
    const [record] = await base(tables.WHEEL_BALANCE).create([{
      fields: {
        TG_id: String(tgId),
        'User Name': userName || 'Користувач',
        Status: 'In Progress',
        Step: 1,
        Created_Date: todayISO()
      }
    }], { typecast: true });
    
    logger.info(`✅ [wheelBalance] Створено колесо ${record.id} для ${tgId}`);
    return record;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка createWheel:', error);
    throw error;
  }
};

export const updateWheel = async (recordId, fields) => {
  try {
    await base(tables.WHEEL_BALANCE).update(recordId, fields, { typecast: true });
    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка updateWheel:', error);
    throw error;
  }
};

export const completeWheel = async (recordId, totalScore, analysis) => {
  try {
    await base(tables.WHEEL_BALANCE).update(recordId, {
      Status: 'Completed',
      Completed_Date: todayISO(),
      Total_Score: totalScore,
      AI_Analysis: analysis?.substring(0, 10000) || 'Аналіз недоступний',
      Step: 8
    }, { typecast: true });
    
    logger.info(`✅ [wheelBalance] Завершено колесо ${recordId}`);
    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка completeWheel:', error);
    throw error;
  }
};

export const canStartNewWheel = async (tgId) => {
  try {
    const lastCompleted = await getLatestCompletedWheel(tgId);

    if (!lastCompleted) {
      return { allowed: true, reason: null };
    }

    const completedDate = new Date(
      lastCompleted.fields.Completed_Date || lastCompleted.fields.Created_Date
    );
    const daysSince = Math.floor((Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince < 30) {
      const daysLeft = 30 - daysSince;
      return {
        allowed: false,
        reason: `Подождите ${daysLeft} днів перед новим колесом`,
        daysLeft,
        lastDate: completedDate
      };
    }

    return { allowed: true, reason: null };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка canStartNewWheel:', error);
    return { allowed: true, reason: null };
  }
};

console.log('✅ [services/wheelBalance/database] Завантажено');