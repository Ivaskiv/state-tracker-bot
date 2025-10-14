// src/services/wheelBalance/database.js
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { todayISO } from './utils.js';

const base = getBase();

export const getActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`,
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

// ✅ НОВА ФУНКЦІЯ: перевірити чи чекаємо нотатку
export const isAwaitingNote = async (tgId) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) return null;
    
    const step = Number(activeWheel.fields.Step || 0);
    const scoreField = `Health`; // Перше поле - Health
    const allScoreFields = [
      'Health', 'Self_Growth', 'Relationships', 'Career_Business',
      'Finance', 'Rest_Leisure', 'Spirituality', 'Housing'
    ];
    
    // Перевіряємо чи є оцінка для поточного кроку
    const currentScoreField = allScoreFields[step];
    const score = activeWheel.fields[currentScoreField];
    
    if (score != null) {
      // Є оцінка - чекаємо нотатку
      return {
        recordId: activeWheel.id,
        step,
        score,
        sphereName: [
          'Здоров\'я та енергія',
          'Особистісний розвиток',
          'Стосунки (сім\'я, друзі)',
          'Кар\'єра та професія',
          'Фінанси та достаток',
          'Дозвілля та відпочинок',
          'Духовність та цінності',
          'Побут та оточення'
        ][step]
      };
    }
    
    return null;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка isAwaitingNote:', error);
    return null;
  }
};

export const cancelActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")` })
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
        Status: 'Active',
        Step: 0,
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
      AI_Analysis: analysis,
      Step: 8
    }, { typecast: true });
    
    logger.info(`✅ [wheelBalance] Завершено колесо ${recordId}`);
    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка completeWheel:', error);
    throw error;
  }
};