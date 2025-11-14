//src/services/gamificationHub.js
// Централізована система нагород
import levelsService from '../core/gamification/levels.js';
import badgesService from '../core/gamification/badges.js';
import logger from '../utils/logger.js';

const REWARDS = {
  // Funnel rewards
  FUNNEL_VIDEO: 10,
  FUNNEL_BONUS: 50,
  FUNNEL_LIFE_LOST: -5,
  
  // Core rewards
  SESSION_MORNING: 5,
  SESSION_EVENING: 5,
  WHEEL_COMPLETED: 15,
  AI_INTERACTION: 2,
  WEEKLY_REPORT: 10,
  
  // Streak rewards
  STREAK_DAY: 2,
  STREAK_7: 20,
  STREAK_14: 50,
  STREAK_30: 100
};

export const reward = async (tgId, eventType, bot = null) => {
  const points = REWARDS[eventType];
  
  if (!points) {
    logger.warn(`[gamificationHub] Unknown event: ${eventType}`);
    return null;
  }
  
  const result = await levelsService.addPoints(tgId, points, eventType);
  
  if (result?.leveledUp && bot) {
    await bot.telegram.sendMessage(
      tgId,
      `🎉 **LEVEL UP!**\n\n` +
      `${result.newLevel.icon} ${result.newLevel.userName}\n` +
      `💰 Всього: ${result.totalPoints} балів`,
      { parse_mode: 'Markdown' }
    );
  }
  
  await badgesService.checkAndAwardBadges(tgId, bot);
  
  return result;
};

export default { reward, REWARDS };