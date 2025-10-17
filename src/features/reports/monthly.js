// ========================================
// src/features/reports/monthly.js
// ========================================
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const generateMonthlyReport = async (tgId) => {
  try {
    logger.info(`[reports/monthly] 📊 Генерація щомісячного звіту для ${tgId}`);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthStr = monthAgo.toISOString().split('T')[0];

    //響
    const responses = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id} = "${tgId}", {Date_Response} >= "${monthStr}")`
      })
      .all();

    // Колеса
    const wheels = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id} = "${tgId}", {Status} = "Completed", {Completed_Date} >= "${monthStr}")`
      })
      .all();

    const morningCount = responses.filter(r => r.fields.Q_m_6).length;
    const eveningCount = responses.filter(r => r.fields.Q_e_7).length;

    return {
      period: 'month',
      morningCompleted: morningCount,
      eveningCompleted: eveningCount,
      totalSessions: morningCount + eveningCount,
      wheelsCompleted: wheels.length,
      daysActive: new Set(responses.map(r => r.fields.Date_Response)).size,
      avgSessionsPerDay: (morningCount + eveningCount) / 30
    };
  } catch (error) {
    logger.error('[reports/monthly] ❌ Помилка:', error);
    return null;
  }
};

console.log('✅ [reports/monthly] Завантажено');
