// src/services/funnelEngine.js
import { getBase, tables, createRows, updateRows } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

// ═══════════════════════════════════════════════════════════
// REGISTRY - реєстр всіх воронок
// ═══════════════════════════════════════════════════════════

const funnelRegistry = new Map();

export const registerFunnel = (key, config) => {
  funnelRegistry.set(key, {
    key,
    name: config.name || key,
    totalSteps: config.totalSteps || 5,
    durationHours: config.durationHours || 24,
    maxLives: config.maxLives || 5,
    tableName: config.tableName,
    handlers: config.handlers || {},
    metadata: config.metadata || {}
  });
  
  logger.info(`[funnelEngine] ✅ Registered: ${key}`);
};

export const getFunnelConfig = (key) => funnelRegistry.get(key);

export const getAllFunnels = () => Array.from(funnelRegistry.values());

// ═══════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════

export const createFunnel = async (tgId, funnelKey) => {
  const config = getFunnelConfig(funnelKey);
  if (!config) throw new Error(`Funnel ${funnelKey} not found`);
  
  const start = new Date();
  const end = new Date(start.getTime() + config.durationHours * 3600000);
  
  const [record] = await createRows(config.tableName, [{
    fields: {
      TG_id: String(tgId),
      funnel_key: funnelKey,
      status: 'active',
      current_step: 0,
      total_steps: config.totalSteps,
      lives_remaining: config.maxLives,
      started_at: start.toISOString(),
      expires_at: end.toISOString(),
      completed_steps: '[]',
      metadata: JSON.stringify(config.metadata)
    }
  }]);
  
  logger.info(`[funnelEngine] Created ${funnelKey} for ${tgId}`);
  return record;
};

export const getFunnelProgress = async (tgId, funnelKey) => {
  const config = getFunnelConfig(funnelKey);
  if (!config) return null;
  
  const records = await base(config.tableName)
    .select({
      filterByFormula: `AND({TG_id}="${tgId}", {funnel_key}="${funnelKey}")`,
      sort: [{ field: 'started_at', direction: 'desc' }],
      maxRecords: 1
    })
    .firstPage();
  
  return records[0] || null;
};

export const updateFunnelStep = async (funnelKey, recordId, step, data = {}) => {
  const config = getFunnelConfig(funnelKey);
  if (!config) throw new Error(`Funnel ${funnelKey} not found`);
  
  await updateRows(config.tableName, [{
    id: recordId,
    fields: {
      current_step: step,
      last_activity: new Date().toISOString(),
      ...data
    }
  }]);
};

export const completeFunnelStep = async (funnelKey, recordId, step) => {
  const progress = await base(getFunnelConfig(funnelKey).tableName).find(recordId);
  const completed = JSON.parse(progress.fields.completed_steps || '[]');
  
  if (!completed.includes(step)) {
    completed.push(step);
  }
  
  await updateFunnelStep(funnelKey, recordId, step, {
    completed_steps: JSON.stringify(completed)
  });
};

export const completeFunnel = async (funnelKey, recordId, reward = null) => {
  const config = getFunnelConfig(funnelKey);
  
  await updateRows(config.tableName, [{
    id: recordId,
    fields: {
      status: 'completed',
      completed_at: new Date().toISOString(),
      reward: reward ? JSON.stringify(reward) : null
    }
  }]);
};

export const loseLife = async (funnelKey, recordId, reason = '') => {
  const config = getFunnelConfig(funnelKey);
  const progress = await base(config.tableName).find(recordId);
  const lives = progress.fields.lives_remaining - 1;
  
  await updateRows(config.tableName, [{
    id: recordId,
    fields: {
      lives_remaining: Math.max(0, lives),
      last_life_lost: new Date().toISOString(),
      life_lost_reason: reason
    }
  }]);
  
  return lives;
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

export const isFunnelExpired = (progressRecord) => {
  if (!progressRecord?.fields?.expires_at) return false;
  return new Date(progressRecord.fields.expires_at) < new Date();
};

export const isFunnelCompleted = (progressRecord) => {
  return progressRecord?.fields?.status === 'completed';
};

export const hasLivesRemaining = (progressRecord) => {
  return (progressRecord?.fields?.lives_remaining || 0) > 0;
};

export const getTimeRemaining = (progressRecord) => {
  if (!progressRecord?.fields?.expires_at) return 0;
  const end = new Date(progressRecord.fields.expires_at);
  const now = new Date();
  return Math.max(0, end - now);
};

export const formatTimeRemaining = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}д ${hours % 24}год`;
  }
  
  return `${hours}год ${minutes}хв`;
};

// ═══════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════

export default {
  registerFunnel,
  getFunnelConfig,
  getAllFunnels,
  createFunnel,
  getFunnelProgress,
  updateFunnelStep,
  completeFunnelStep,
  completeFunnel,
  loseLife,
  isFunnelExpired,
  isFunnelCompleted,
  hasLivesRemaining,
  getTimeRemaining,
  formatTimeRemaining
};