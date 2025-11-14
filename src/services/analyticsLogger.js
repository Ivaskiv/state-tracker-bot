//src/services/analyticsLogger.js
// Централізоване логування подій
import { trackProgress } from './progressTracker.js';

export const logEvent = async (tgId, event, data = {}) => {
  console.log(`[analytics] 📊 ${event}:`, { tgId, ...data });
  
  await trackProgress(tgId, `event_${event}`, {
    action: event,
    value: 1,
    metadata: data
  });
};

export default { logEvent };