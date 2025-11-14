// src/services/tilda.js
import { getUserStats } from './stats.js';

export async function getTildaProfile(tgId) {
  const stats = await getUserStats(tgId);
  
  return {
    tgId,
    name: stats.userName,
    level: stats.level,
    points: stats.totalPoints,
    badges: stats.badges,
    funnels: {
      video5: { completed: stats.video5Completed, progress: stats.video5Progress },
      trial7: { active: stats.trial7Active, daysLeft: stats.trial7DaysLeft },
    },
  };
}

// Webhook endpoint (додати в server.js)
app.post('/api/tilda/profile', async (req, res) => {
  const { tgId } = req.body;
  const profile = await getTildaProfile(tgId);
  res.json(profile);
});