// ========================================
// src/services/goals.js
// ========================================
import { getBase, tables, createRows, updateRows } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

export const createGoal = async (tgId, goalText, priority = 5) => {
  try {
    logger.info(`[goals] 🎯 Створення цілі для ${tgId}`);

    const goal = await createRows(tables.USER_GOALS, [{
      fields: {
        TG_id: String(tgId),
        Goal_Text: goalText.substring(0, 500),
        Goal_Priority: priority,
        Status: 'active',
        Progress: 0,
        Created_Date: new Date().toISOString().split('T')[0]
      }
    }]);

    return goal[0];
  } catch (error) {
    logger.error('[goals] ❌ Помилка createGoal:', error);
    throw error;
  }
};

export const updateGoalProgress = async (goalId, progress) => {
  try {
    await updateRows(tables.USER_GOALS, [{
      id: goalId,
      fields: { Progress: Math.min(100, progress) }
    }]);

    logger.info(`[goals] ✅ Прогрес оновлено: ${progress}%`);
  } catch (error) {
    logger.error('[goals] ❌ Помилка updateGoalProgress:', error);
    throw error;
  }
};

export const getUserGoals = async (tgId, status = 'active') => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "${status}")`;
    
    const records = await base(tables.USER_GOALS)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Goal_Priority', direction: 'desc' }]
      })
      .all();

    return records.map(r => ({
      id: r.id,
      ...r.fields
    }));
  } catch (error) {
    logger.error('[goals] ❌ Помилка getUserGoals:', error);
    return [];
  }
};

console.log('✅ [services/goals] Завантажено');
