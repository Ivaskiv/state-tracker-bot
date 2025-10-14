// Синхронізація з іншими таблицями

// src/services/dailySessions/sync.js
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';
import * as db from './database.js';
import * as utils from './utils.js'; 

const base = getBase();

// ===== СИНХРОНІЗАЦІЯ ЦІЛЕЙ =====
export const syncGoals = async (tgId, data) => {
  try {
    const today = utils.todayStr();
    const newGoals = [];

    for (let i = 1; i <= 10; i++) {
      const g = data[`Goal_${i}`] || data[`Daily_Goal_${i}`];
      if (utils.normalize(g)) {
        newGoals.push({
          text: utils.normalize(g),
          priority: 11 - i
        });
      }
    }

    if (!newGoals.length) {
      logger.info(`ℹ️ [dailySessions] Немає цілей для синхронізації ${tgId}`);
      return 0;
    }

    const existing = await base(tables.USER_GOALS)
      .select({ filterByFormula: `{TG_id}="${tgId}"` })
      .all();

    const existingMap = {};
    existing.forEach(rec => {
      const txt = utils.normalize(rec.fields?.Goal_Text || '');
      if (txt) existingMap[txt] = rec;
    });

    const toCreate = [];
    const toUpdate = [];

    newGoals.forEach(g => {
      if (existingMap[g.text]) {
        const rec = existingMap[g.text];
        toUpdate.push({
          id: rec.id,
          fields: {
            Goal_Priority: g.priority,
            Status: rec.fields?.Status || 'active'
          }
        });
        delete existingMap[g.text];
      } else {
        toCreate.push({
          fields: {
            TG_id: String(tgId),
            Goal_Text: g.text,
            Goal_Priority: g.priority,
            Status: 'active',
            Created_Date: today
          }
        });
      }
    });

    const toDeactivate = Object.values(existingMap).map(r => ({
      id: r.id,
      fields: { Status: 'inactive' }
    }));

    // Batch операції
    if (toUpdate.length) {
      for (const batch of utils.chunk(toUpdate, 10)) {
        await base(tables.USER_GOALS).update(batch);
      }
    }

    if (toDeactivate.length) {
      for (const batch of utils.chunk(toDeactivate, 10)) {
        await base(tables.USER_GOALS).update(batch);
      }
    }

    if (toCreate.length) {
      for (const batch of utils.chunk(toCreate, 10)) {
        await base(tables.USER_GOALS).create(batch);
      }
    }

    logger.info(`✅ [dailySessions] Синхронізовано цілей: ${toCreate.length} нових, ${toUpdate.length + toDeactivate.length} оновлено`);
    return toCreate.length + toUpdate.length;
  } catch (error) {
    logger.error('❌ [dailySessions] syncGoals:', error);
    throw error;
  }
};

// ===== СИНХРОНІЗАЦІЯ ДІЙ =====
export const syncActions = async (tgId, data) => {
  try {
    const today = utils.todayStr();
    
    const existing = await base(tables.MICRO_ACTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}", {Source}="user_input")`
      })
      .firstPage();

    if (existing.length) {
      logger.info(`ℹ️ [dailySessions] Дії вже існують для ${tgId}`);
      return 0;
    }

    const actions = [];
    for (let i = 1; i <= 3; i++) {
      const a = utils.normalize(data[`Daily_Action_${i}`] || data[`Action_${i}`]);
      if (a) {
        actions.push({
          fields: {
            TG_id: String(tgId),
            Date: today,
            Action_Text: a,
            Status: 'pending',
            Source: 'user_input',
            Priority: i === 1 ? 'висока' : i === 2 ? 'середня' : 'низька',
            Created_At: new Date().toISOString()
          }
        });
      }
    }

    if (actions.length) {
      for (const batch of utils.chunk(actions, 10)) {
        await base(tables.MICRO_ACTIONS).create(batch);
      }
    }

    logger.info(`✅ [dailySessions] Синхронізовано ${actions.length} дій для ${tgId}`);
    return actions.length;
  } catch (error) {
    logger.error('❌ [dailySessions] syncActions:', error);
    throw error;
  }
};

// ===== СИНХРОНІЗАЦІЯ РАНКУ =====
export const syncMorningData = async (tgId) => {
  try {
    const todayRecord = await db.getTodayRecord(tgId);
    
    if (!todayRecord) {
      logger.info(`ℹ️ [dailySessions] Немає даних для синхронізації ${tgId}`);
      return { success: false, message: 'No data' };
    }

    const data = todayRecord.fields || {};

    const goalsSynced = await syncGoals(tgId, data);
    const actionsSynced = await syncActions(tgId, data);

    logger.info(`✅ [dailySessions] Ранкова синхронізація ${tgId}: цілей=${goalsSynced}, дій=${actionsSynced}`);
    
    return { 
      success: true, 
      goalsSynced, 
      actionsSynced 
    };
  } catch (error) {
    logger.error('❌ [dailySessions] syncMorningData:', error);
    throw error;
  }
};

// ===== СИНХРОНІЗАЦІЯ ВЕЧОРА =====
export const syncEveningData = async (tgId) => {
  try {
    const todayRecord = await db.getTodayRecord(tgId);
    
    if (!todayRecord) {
      return { success: false };
    }

    const data = todayRecord.fields || {};
    const victory = data.Q_e_7; // Головна перемога

    const today = utils.todayStr();
    const stats = await base(tables.ACTIVITY_STATS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`,
        maxRecords: 1
      })
      .firstPage();

    if (stats.length) {
      await base(tables.ACTIVITY_STATS).update(stats[0].id, {
        Has_Victory: !!victory,
        Evening_Completed: true
      });
    } else {
      await base(tables.ACTIVITY_STATS).create({
        TG_id: String(tgId),
        Date: today,
        Has_Victory: !!victory,
        Evening_Completed: true,
        Created_At: new Date().toISOString()
      });
    }

    logger.info(`✅ [dailySessions] Вечірня синхронізація для ${tgId}`);
    return { success: true, victory: !!victory };
  } catch (error) {
    logger.error('❌ [dailySessions] syncEveningData:', error);
    throw error;
  }
};