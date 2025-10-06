// src/services/dataSyncService.js - СИНХРОНІЗАЦІЯ ДАНИХ МІЖ ТАБЛИЦЯМИ

import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

/**
 * ✅ Копіює Goals з Responses в USER_GOALS
 */
const syncGoalsToUserGoals = async (tgId, responseData) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const goals = [];
    
    // Видаляємо старі цілі (опціонально - якщо хочемо перезаписувати)
    const oldGoals = await base(tables.USER_GOALS)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", {Status}="active")`
      })
      .all();
    
    if (oldGoals.length > 0) {
      await base(tables.USER_GOALS).destroy(oldGoals.map(r => r.id));
      logger.info(`[dataSyncService] 🗑️ Видалено ${oldGoals.length} старих цілей`);
    }
    
    // Створюємо нові
    for (let i = 1; i <= 10; i++) {
      const goalText = responseData[`Goal_${i}`];
      if (goalText && goalText.trim()) {
        goals.push({
          fields: {
            TG_id: String(tgId),
            Goal_Text: goalText.trim(),
            Goal_Priority: 11 - i, // 10, 9, 8...
            Status: 'active',
            Created_Date: today
          }
        });
      }
    }
    
    if (goals.length > 0) {
      const created = await base(tables.USER_GOALS).create(goals);
      logger.info(`[dataSyncService] ✅ Синхронізовано ${created.length} цілей`);
      return created.length;
    }
    
    return 0;
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncGoalsToUserGoals:', error);
    return 0;
  }
};

/**
 * ✅ Копіює Daily Actions з Responses в MICRO_ACTIONS
 */
const syncActionsToMicroActions = async (tgId, responseData) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const actions = [];
    
    // Перевіряємо чи вже є дії на сьогодні (щоб не дублювати)
    const existingActions = await base(tables.MICRO_ACTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date})="${today}", {Source}="user_input")`
      })
      .firstPage();
    
    if (existingActions.length > 0) {
      logger.info(`[dataSyncService] ℹ️ Дії вже існують для ${tgId}`);
      return 0;
    }
    
    // Створюємо нові
    for (let i = 1; i <= 3; i++) {
      const actionText = responseData[`Daily_Action_${i}`];
      if (actionText && actionText.trim()) {
        actions.push({
          fields: {
            TG_id: String(tgId),
            Date: today,
            Action_Text: actionText.trim(),
            Status: 'pending',
            Source: 'user_input',
            Priority: i === 1 ? 'висока' : (i === 2 ? 'середня' : 'низька'),
            Created_At: new Date().toISOString()
          }
        });
      }
    }
    
    if (actions.length > 0) {
      const created = await base(tables.MICRO_ACTIONS).create(actions);
      logger.info(`[dataSyncService] ✅ Синхронізовано ${created.length} дій`);
      return created.length;
    }
    
    return 0;
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncActionsToMicroActions:', error);
    return 0;
  }
};

/**
 * ✅ ГОЛОВНА ФУНКЦІЯ: Синхронізує всі дані після ранкової сесії
 */
export const syncMorningData = async (tgId) => {
  try {
    logger.info(`[dataSyncService] 🔄 Початок синхронізації для ${tgId}`);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Отримуємо дані з Responses
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) {
      logger.warn(`[dataSyncService] ⚠️ Немає даних для синхронізації`);
      return { success: false, message: 'Немає даних' };
    }
    
    const data = records[0].fields;
    
    // Синхронізуємо Goals
    const goalsSynced = await syncGoalsToUserGoals(tgId, data);
    
    // Синхронізуємо Actions
    const actionsSynced = await syncActionsToMicroActions(tgId, data);
    
    logger.info(`[dataSyncService] ✅ Синхронізація завершена: ${goalsSynced} цілей, ${actionsSynced} дій`);
    
    return {
      success: true,
      goalsSynced,
      actionsSynced,
      message: `Синхронізовано: ${goalsSynced} цілей, ${actionsSynced} дій`
    };
    
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncMorningData:', error);
    return { success: false, message: error.message };
  }
};

/**
 * ✅ Синхронізує вечірні дані (позначає виконані дії)
 */
export const syncEveningData = async (tgId) => {
  try {
    logger.info(`[dataSyncService] 🌙 Синхронізація вечірніх даних для ${tgId}`);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Отримуємо вечірні відповіді
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) return { success: false };
    
    const data = records[0].fields;
    const victory = data.Q_e_5; // "Що було зроблено"
    
    // Оновлюємо статистику в ACTIVITY_STATS
    await base(tables.ACTIVITY_STATS)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date})="${today}")`,
        maxRecords: 1
      })
      .firstPage()
      .then(async (stats) => {
        if (stats.length > 0) {
          await base(tables.ACTIVITY_STATS).update(stats[0].id, {
            Has_Victory: !!victory,
            Evening_Completed: true
          });
        }
      });
    
    logger.info(`[dataSyncService] ✅ Вечірні дані синхронізовано`);
    return { success: true };
    
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncEveningData:', error);
    return { success: false };
  }
};

export default {
  syncMorningData,
  syncEveningData,
  syncGoalsToUserGoals,
  syncActionsToMicroActions
};

console.log('✅ [dataSyncService] Сервіс синхронізації даних ініціалізовано');