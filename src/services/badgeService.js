import { getBase, tables } from '../config/database.js';
import userService from './userService.js';
import activityTracker from './activityTracker.js';

const base = getBase();

const BADGES = {
  beginner: 'Початківець — пройшов 1 місячний аудит',
  weekFocus: '7-днів фокус — 7 днів без пропусків',
  winner: 'Переможець — досяг 1 річної цілі на 30%+ прогресу',
  transformer: 'Перетворювач — 30 днів регулярності'
};

const badgeService = {

  async assignBadges(tgId) {
    try {
      const user = await userService.getUserByTgId(tgId);
      if (!user) return [];

      const badges = user.badges || [];

      // 1. Beginner — пройшов місяць
      if (!badges.includes('beginner') && user.audit_completed_days >= 30) {
        badges.push('beginner');
        await badgeService.notifyBadge(tgId, 'beginner', user['User Name']);
      }

      // 2. 7-days focus
      if (!badges.includes('weekFocus') && user.seven_days_no_miss) {
        badges.push('weekFocus');
        await badgeService.notifyBadge(tgId, 'weekFocus', user['User Name']);
      }

      // 3. Winner
      if (!badges.includes('winner') && user.year_goal_progress >= 30) {
        badges.push('winner');
        await badgeService.notifyBadge(tgId, 'winner', user['User Name']);
      }

      // 4. Transformer
      if (!badges.includes('transformer') && user.regular_days_count >= 30) {
        badges.push('transformer');
        await badgeService.notifyBadge(tgId, 'transformer', user['User Name']);
      }

      // Зберігаємо у профілі користувача
      await userService.updateUserFields(tgId, { badges });

      return badges;

    } catch (error) {
      console.error('[badgeService] ❌ assignBadges:', error);
      return [];
    }
  },

  async getUserBadges(tgId) {
    const user = await userService.getUserByTgId(tgId);
    return user?.badges || [];
  },

  async notifyBadge(tgId, badgeKey, userName) {
    const badgeText = BADGES[badgeKey] || badgeKey;
    // Тут виклик Telegram через ctx або bot
    console.log(`🎖️ Бейдж: ${badgeText} — Молодець, ${userName}! Це доказ, що ти дієш. Тримай темп.`);
  }

};

export default badgeService;
