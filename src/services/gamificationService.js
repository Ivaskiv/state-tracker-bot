// src/services/gamificationService.js

import badgeService from './badgeService.js';
import activityTracker from './activityTracker.js';
import { getBase, tables } from '../config/database.js';

const BADGES = {
  FIRST_MONTH: { key: 'first_month', name: '🏆 Перший місяць', desc: 'Завершив перше колесо балансу' },
  STREAK_7: { key: 'streak_7', name: '🔥 Тиждень без пропусків', desc: '7 днів поспіль' },
  STREAK_21: { key: 'streak_21', name: '💎 21 день сили', desc: '21 день без пропусків' },
  GOAL_30: { key: 'goal_30', name: '🎯 На шляху до цілі', desc: '30%+ прогресу до річної цілі' }
};

const MILESTONES = [
  { name: 'Початківець', completedDays: 7, reward: 'streak_7' },
  { name: 'Майстер звички', completedDays: 21, reward: 'streak_21' },
  { name: 'Трансформатор', completedDays: 30, reward: 'first_month' }
];

export const checkAndAwardBadges = async (tgId, bot) => {
  const stats = await activityTracker.calculateDailyStats(tgId);
  const badges = await badgeService.getUserBadges(tgId);
  const newBadges = [];

  // Перевірка стріків
  if (stats.streak >= 7 && !badges.includes('streak_7')) {
    await badgeService.awardBadge(tgId, 'streak_7');
    newBadges.push(BADGES.STREAK_7);
  }

  if (stats.streak >= 21 && !badges.includes('streak_21')) {
    await badgeService.awardBadge(tgId, 'streak_21');
    newBadges.push(BADGES.STREAK_21);
  }

  // Надсилаємо повідомлення про нові бейджі
  if (newBadges.length > 0 && bot) {
    for (const badge of newBadges) {
      await bot.telegram.sendMessage(
        tgId,
        `🎉 НОВИЙ БЕЙДЖ!\n\n${badge.name}\n${badge.desc}\n\n💪 Продовжуй у тому ж дусі!`
      );
    }
  }

  return newBadges;
};

export const getProgressToGoal = async (tgId, goalId) => {
  // Логіка підрахунку прогресу до конкретної цілі
  const actions = await activityTracker.getActionsForGoal(tgId, goalId);
  const completed = actions.filter(a => a.status === 'completed').length;
  const total = actions.length;
  
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

export default {
  checkAndAwardBadges,
  getProgressToGoal,
  BADGES,
  MILESTONES
};