// ========================================
// src/features/reports/progress.js
// ========================================
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const getUserProgress = async (tgId) => {
  try {
    logger.info(`[reports/progress] 📈 Отримання прогресу для ${tgId}`);

    // Користувач
    const user = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: ['Total_Points', 'Current_Level', 'Total_Sessions']
      })
      .firstPage();

    if (!user.length) return null;

    const userData = user[0].fields;

    // Цілі
    const goals = await base(tables.USER_GOALS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`
      })
      .all();

    const avgProgress = goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.fields.Progress || 0), 0) / goals.length)
      : 0;

    return {
      totalPoints: userData.Total_Points || 0,
      currentLevel: userData.Current_Level || 1,
      totalSessions: userData.Total_Sessions || 0,
      averageGoalProgress: avgProgress,
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.fields.Progress >= 100).length
    };
  } catch (error) {
    logger.error('[reports/progress] ❌ Помилка:', error);
    return null;
  }
};

console.log('✅ [reports/progress] Завантажено');
