//src/services/progressTracker.js
// Універсальний трекер прогресу
import { getBase, tables } from '../config/database.js';

const base = getBase();

export const trackProgress = async (tgId, context, data) => {
  const timestamp = new Date().toISOString();
  
  await base(tables.ACTIVITY_STATS).create([{
    fields: {
      TG_id: String(tgId),
      context, // 'funnel_video_1', 'wheel_completed', etc.
      action: data.action,
      value: data.value,
      timestamp,
      metadata: JSON.stringify(data.metadata || {})
    }
  }]);
};

export const getProgressSummary = async (tgId, context) => {
  const records = await base(tables.ACTIVITY_STATS)
    .select({
      filterByFormula: `AND({TG_id}="${tgId}", {context}="${context}")`,
      sort: [{ field: 'timestamp', direction: 'desc' }]
    })
    .all();
  
  return records.map(r => r.fields);
};

export default { trackProgress, getProgressSummary };