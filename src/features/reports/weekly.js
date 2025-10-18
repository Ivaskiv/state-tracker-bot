// ========================================
// src/features/reports/weekly.js
// ========================================
import { getBase, tables, createRows } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const generateWeeklyReport = async (tgId) => {
  try {
    logger.info(`[reports/weekly] 📊 Генерація тижневого звіту для ${tgId}`);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().split('T')[0];

    const responses = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id} = "${tgId}", {Date_Response} >= "${weekStr}")`
      })
      .all();

    const morningCount = responses.filter(r => r.fields.Q_m_6).length;
    const eveningCount = responses.filter(r => r.fields.Q_e_7).length;

    const reportData = {
      period: 'week',
      morningCompleted: morningCount,
      eveningCompleted: eveningCount,
      totalSessions: morningCount + eveningCount,
      daysActive: new Set(responses.map(r => r.fields.Date_Response)).size
    };

    try {
      await createRows(tables.USER_REPORTS, [{
        fields: {
          TG_id: String(tgId),
          Report_Type: 'weekly',
          Report_Date: new Date().toISOString().split('T')[0],
          Morning_Sessions: morningCount,
          Evening_Sessions: eveningCount,
          Total_Sessions: morningCount + eveningCount,
          Active_Days: reportData.daysActive,
          Created_At: new Date().toISOString()
        }
      }]);
      
      logger.info(`[reports/weekly] ✅ Звіт збережено у БД для ${tgId}`);
    } catch (saveError) {
      logger.warn(`[reports/weekly] ⚠️ Не вдалося зберегти звіт у БД:`, saveError.message);
      // Продовжуємо роботу навіть якщо збереження не вдалось
    }

    return reportData;
  } catch (error) {
    logger.error('[reports/weekly] ❌ Помилка:', error);
    return null;
  }
};
console.log('✅ [reports/weekly] Завантажено');
