// ========================================
// src/services/stats.js
// ========================================
import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

export const calculateUserStats = async (tgId) => {
  try {
    logger.info(`[stats] 📊 Розрахунок статистики для ${tgId}`);

    // 1. Активні дні
    const responsesRecords = await base(tables.RESPONSES)
      .select({ filterByFormula: `{TG_id} = "${tgId}"` })
      .all();

    const uniqueDates = new Set(
      responsesRecords.map(r => r.fields.Date_Response)
    );
    const totalActiveDays = uniqueDates.size;

    // 2. Завершені колеса
    const wheelRecords = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id} = "${tgId}", {Status} = "Completed")`
      })
      .all();

    const wheelCount = wheelRecords.length;
    const lastWheelScore = wheelRecords[0]?.fields.Total_Score || null;

    // 3. Цілі
    const goalRecords = await base(tables.USER_GOALS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`
      })
      .all();

    const completedGoals = goalRecords.filter(g => g.fields.Progress >= 100).length;

    return {
      totalActiveDays,
      wheelsCompleted: wheelCount,
      lastWheelScore,
      totalGoals: goalRecords.length,
      completedGoals,
      avgWheelScore: wheelRecords.length > 0
        ? Math.round(
            wheelRecords.reduce((sum, w) => sum + (w.fields.Total_Score || 0), 0) /
            wheelRecords.length
          )
        : null
    };
  } catch (error) {
    logger.error('[stats] ❌ Помилка calculateUserStats:', error);
    return null;
  }
};

console.log('✅ [services/stats] Завантажено');
