// src/webhooks/tilda.js 
import express from 'express';

const router = express.Router();

router.post('/tilda/user-status', async (req, res) => {
  const { tgId } = req.body;
  
  const user = await getUserByTgId(tgId);
  const stats = await getUserStats(tgId);
  
  res.json({
    name: user.fields['User Name'],
    level: stats.totalPoints,
    badges: user.fields.Badges || [],
    progress: {
      funnel_5video: 80, // %
      wheel: true,
      streak: stats.currentStreak
    }
  });
});

export default router;