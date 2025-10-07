// src/services/dataSyncService.js

import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

// ===== РАНКОВА СИНХРОНІЗАЦІЯ =====
const syncGoalsToUserGoals = async (tgId, data) => {
  const today = new Date().toISOString().split('T')[0];
  const oldGoals = await base(tables.USER_GOALS)
    .select({ filterByFormula: `{TG_id}="${tgId}"` })
    .all();
  if (oldGoals.length) await base(tables.USER_GOALS).destroy(oldGoals.map(r => r.id));

  const goals = [];
  for (let i = 1; i <= 10; i++) {
    const g = data[`Goal_${i}`];
    if (g?.trim()) goals.push({ fields: { TG_id: tgId, Goal_Text: g.trim(), Goal_Priority: 11 - i, Status: 'active', Created_Date: today } });
  }
  if (goals.length) {
    const created = await base(tables.USER_GOALS).create(goals);
    return created.length;
  }
  return 0;
};

const syncActionsToMicroActions = async (tgId, data) => {
  const today = new Date().toISOString().split('T')[0];
  const existing = await base(tables.MICRO_ACTIONS)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}", {Source}="user_input")` })
    .firstPage();
  if (existing.length) return 0;

  const actions = [];
  for (let i = 1; i <= 3; i++) {
    const a = data[`Daily_Action_${i}`];
    if (a?.trim()) actions.push({
      fields: {
        TG_id: tgId,
        Date: today,
        Action_Text: a.trim(),
        Status: 'pending',
        Source: 'user_input',
        Priority: i === 1 ? 'висока' : i === 2 ? 'середня' : 'низька',
        Created_At: new Date().toISOString()
      }
    });
  }
  if (actions.length) await base(tables.MICRO_ACTIONS).create(actions);
  return actions.length;
};

// ===== ГОЛОВНА СИНХРОНІЗАЦІЯ =====
export const syncMorningData = async (tgId) => {
  const today = new Date().toISOString().split('T')[0];
  const records = await base(tables.RESPONSES)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`, maxRecords: 1 })
    .firstPage();
  if (!records.length) return { success: false, message: 'No data' };

  const data = records[0].fields;
  const goalsSynced = await syncGoalsToUserGoals(tgId, data);
  const actionsSynced = await syncActionsToMicroActions(tgId, data);

  logger.info(`[dataSyncService] ✅ Синхронізовано ${goalsSynced} цілей, ${actionsSynced} дій`);
  return { success: true, goalsSynced, actionsSynced };
};

// ===== ВЕЧІРНЯ СИНХРОНІЗАЦІЯ =====
export const syncEveningData = async (tgId) => {
  const today = new Date().toISOString().split('T')[0];
  const records = await base(tables.RESPONSES)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`, maxRecords: 1 })
    .firstPage();
  if (!records.length) return { success: false };

  const data = records[0].fields;
  const victory = data.Q_e_5;
  const stats = await base(tables.ACTIVITY_STATS)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`, maxRecords: 1 })
    .firstPage();

  if (stats.length) {
    await base(tables.ACTIVITY_STATS).update(stats[0].id, { Has_Victory: !!victory, Evening_Completed: true });
  }
  return { success: true };
};

export default {
  syncMorningData,
  syncEveningData,
  syncGoalsToUserGoals,
  syncActionsToMicroActions
};

console.log('✅ [dataSyncService] Сервіс ініціалізовано');
