//src/services/funnelEngine.js
// Універсальний движок для AI-воронок
import { getBase, tables, createRows, updateRows } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

// ═══════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════

export const createFunnel = async (tgId, funnelType, config = {}) => {
  const start = new Date();
  const end = new Date(start.getTime() + (config.durationHours || 24) * 60 * 60 * 1000);
  
  const [record] = await createRows(config.tableName || tables.FREE_FUNNEL, [{
    fields: {
      TG_id: String(tgId),
      funnel_type: funnelType,
      status: 'active',
      current_step: 0,
      total_steps: config.totalSteps || 5,
      lives_remaining: config.maxLives || 5,
      started_at: start.toISOString(),
      expires_at: end.toISOString(),
      metadata: JSON.stringify(config.metadata || {})
    }
  }]);
  
  logger.info(`[funnelEngine] ✅ Created ${funnelType} for ${tgId}`);
  return record;
};

export const getFunnelProgress = async (tgId, tableName) => {
  const records = await base(tableName)
    .select({
      filterByFormula: `{TG_id}="${tgId}"`,
      sort: [{ field: 'started_at', direction: 'desc' }],
      maxRecords: 1
    })
    .firstPage();
  
  return records[0] || null;
};

export const updateFunnelStep = async (recordId, tableName, step, data = {}) => {
  await updateRows(tableName, [{
    id: recordId,
    fields: {
      current_step: step,
      last_activity: new Date().toISOString(),
      ...data
    }
  }]);
};

export const completeFunnel = async (recordId, tableName, reward = null) => {
  await updateRows(tableName, [{
    id: recordId,
    fields: {
      status: 'completed',
      completed_at: new Date().toISOString(),
      reward: reward ? JSON.stringify(reward) : null
    }
  }]);
};

// ═══════════════════════════════════════════════════════════
// HELPER: Check if expired
// ═══════════════════════════════════════════════════════════

export const isFunnelExpired = (funnelRecord) => {
  if (!funnelRecord?.fields?.expires_at) return false;
  return new Date(funnelRecord.fields.expires_at) < new Date();
};

export default {
  createFunnel,
  getFunnelProgress,
  updateFunnelStep,
  completeFunnel,
  isFunnelExpired
};