// ==========================================
// 🎮 СИСТЕМА ГЕЙМІФІКАЦІЇ
// ==========================================
// src/services/gamificationService.js

import { getBase, tables } from '../config/database.js';
import userService from './userService.js';
import activityTracker from './activityTracker.js';

const base = getBase();

// ==========================================
// 🏆 ВИЗНАЧЕННЯ БЕЙДЖІВ
// ==========================================

export const BADGES = {
  BEGINNER: {
    key: 'beginner',
    name: '🌱 Початківець',
    emoji: '🌱',
    title: 'Початківець',
    description: 'Пройшов перший місячний аудит',
    requirement: 'Заповнити колесо балансу',
    message: '🎖️ Бейдж: Початківець\n\nМолодець, {userName}! Ти зробила перший крок до самоаналізу. Це доказ, що ти дієш. Тримай темп! 💪'
  },
  
  WEEK_FOCUS: {
    key: 'week_focus',
    name: '🔥 7-днів фокусу',
    emoji: '🔥',
    title: '7-днів фокусу',
    description: '7 днів поспіль без пропусків',
    requirement: '7 днів завершених ранкових і вечірніх сесій',
    message: '🎖️ Бейдж: 7-днів фокусу\n\nМолодець, {userName}! Тиждень без пропусків — це справжня дисципліна. Це доказ, що ти дієш. Тримай темп! 🔥'
  },
  
  WINNER: {
    key: 'winner',
    name: '🎯 Переможець',
    emoji: '🎯',
    title: 'Переможець',
    description: 'Досяг 30%+ прогресу до річної цілі',
    requirement: '30% виконання по одній з річних цілей',
    message: '🎖️ Бейдж: Переможець\n\nМолодець, {userName}! 30% до цілі — це серйозний прогрес. Це доказ, що ти дієш. Тримай темп! 🎯'
  },
  
  TRANSFORMER: {
    key: 'transformer',
    name: '✨ Перетворювач',
    emoji: '✨',
    title: 'Перетворювач',
    description: '30 днів регулярності',
    requirement: '30 днів завершених сесій',
    message: '🎖️ Бейдж: Перетворювач\n\nМолодець, {userName}! Місяць регулярності — це справжня трансформація. Це доказ, що ти дієш. Тримай темп! ✨'
  },

  ACTION_HERO: {
    key: 'action_hero',
    name: '💪 Герой дії',
    emoji: '💪',
    title: 'Герой дії',
    description: '100 мікро-дій завершено',
    requirement: '100 завершених мікро-дій',
    message: '🎖️ Бейдж: Герой дії\n\nМолодець, {userName}! 100 дій — це сила! Це доказ, що ти дієш. Тримай темп! 💪'
  }
};

// ==========================================
// ✅ ПЕРЕВІРКА ТА ПРИСВОЄННЯ БЕЙДЖІВ
// ==========================================

export const checkAndAwardBadges = async (tgId, bot = null) => {
  try {
    console.log(`[gamification] 🎮 Перевірка бейджів для ${tgId}`);
    
    const user = await userService.getUserByTgId(tgId);
    if (!user) return [];
    
    const currentBadges = user.badges || [];
    const newBadges = [];
    
    // ✅ 1. ПОЧАТКІВЕЦЬ - перше колесо
    if (!currentBadges.includes('beginner')) {
      const hasWheel = await checkFirstWheel(tgId);
      if (hasWheel) {
        newBadges.push(BADGES.BEGINNER);
        currentBadges.push('beginner');
      }
    }
    
    // ✅ 2. 7-ДНІВ ФОКУСУ - streak
    if (!currentBadges.includes('week_focus')) {
      const streak = await checkStreak(tgId, 7);
      if (streak >= 7) {
        newBadges.push(BADGES.WEEK_FOCUS);
        currentBadges.push('week_focus');
      }
    }
    
    // ✅ 3. ПЕРЕМОЖЕЦЬ - 30% до цілі
    if (!currentBadges.includes('winner')) {
      const goalProgress = await checkGoalProgress(tgId);
      if (goalProgress >= 30) {
        newBadges.push(BADGES.WINNER);
        currentBadges.push('winner');
      }
    }
    
    // ✅ 4. ПЕРЕТВОРЮВАЧ - 30 днів
    if (!currentBadges.includes('transformer')) {
      const totalDays = await checkCompletedDays(tgId);
      if (totalDays >= 30) {
        newBadges.push(BADGES.TRANSFORMER);
        currentBadges.push('transformer');
      }
    }
    
    // ✅ 5. ГЕРОЙ ДІЇ - 100 мікро-дій
    if (!currentBadges.includes('action_hero')) {
      const actionsCount = await checkTotalActions(tgId);
      if (actionsCount >= 100) {
        newBadges.push(BADGES.ACTION_HERO);
        currentBadges.push('action_hero');
      }
    }
    
    // ✅ ЗБЕРІГАЄМО БЕЙДЖІ
    if (newBadges.length > 0) {
      await userService.updateUserFields(tgId, { badges: currentBadges });
      
      // ✅ НАДСИЛАЄМО ПОВІДОМЛЕННЯ
      if (bot) {
        for (const badge of newBadges) {
          const message = badge.message.replace('{userName}', user['User Name'] || 'Користувач');
          
          await bot.telegram.sendMessage(tgId, message, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 Мої бейджі', callback_data: 'my_badges' }],
                [{ text: '📊 Мій прогрес', callback_data: 'my_progress' }]
              ]
            }
          });
          
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      console.log(`[gamification] ✅ Присвоєно ${newBadges.length} нових бейджів для ${tgId}`);
    }
    
    return newBadges;
    
  } catch (error) {
    console.error('[gamification] ❌ Помилка перевірки бейджів:', error);
    return [];
  }
};

// ==========================================
// 📊 ПОКАЗ ПРОФІЛЮ З БЕЙДЖАМИ
// ==========================================

export const showProfile = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTgId(tgId);
    
    if (!user) {
      await ctx.reply('Користувача не знайдено. Спробуй /start');
      return;
    }
    
    const userName = user['User Name'] || 'Користувач';
    const badges = user.badges || [];
    
    // ✅ СТАТИСТИКА
    const stats = await getFullStats(tgId);
    
    // ✅ ФОРМУЄМО ПОВІДОМЛЕННЯ
    let message = `👤 ПРОФІЛЬ: ${userName}\n\n`;
    
    // Бейджі
    if (badges.length > 0) {
      message += `🏆 БЕЙДЖІ (${badges.length}/5):\n`;
      badges.forEach(badgeKey => {
        const badge = Object.values(BADGES).find(b => b.key === badgeKey);
        if (badge) {
          message += `${badge.emoji} ${badge.title}\n`;
        }
      });
    } else {
      message += `🏆 БЕЙДЖІ: поки немає\n`;
      message += `💡 Продовжуй працювати — перший бейдж уже близько!\n`;
    }
    
    message += `\n📊 СТАТИСТИКА:\n`;
    message += `• Днів з ботом: ${stats.totalDays}\n`;
    message += `• Завершених сесій: ${stats.completedSessions}\n`;
    message += `• Streak: ${stats.currentStreak} днів\n`;
    message += `• Мікро-дій завершено: ${stats.actionsCompleted}\n`;
    message += `• Середній completion rate: ${stats.avgCompletionRate}%\n`;
    
    if (stats.nextBadge) {
      message += `\n🎯 НАСТУПНИЙ БЕЙДЖ:\n`;
      message += `${stats.nextBadge.emoji} ${stats.nextBadge.title}\n`;
      message += `Прогрес: ${stats.nextBadgeProgress}%\n`;
      message += `${generateProgressBar(stats.nextBadgeProgress)}\n`;
    }
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Детальна статистика', callback_data: 'detailed_stats' }],
          [{ text: '🎯 Наступний бейдж', callback_data: 'next_badge' }]
        ]
      }
    });
  } catch (error) {
    console.error('[gamification] ❌ Помилка показу профілю:', error);
    await ctx.reply('Виникла помилка при завантаженні профілю. Спробуй пізніше.');
  }
};

// ==========================================
// 🛠️ ДОПОМОЖНІ ФУНКЦІЇ
// ==========================================

const generateProgressBar = (percent) => {
  const totalBlocks = 10;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  return '🟩'.repeat(filledBlocks) + '⬜'.repeat(emptyBlocks) + ` ${percent}%`;
};

const getFullStats = async (tgId) => {
  // Тут можна підключити activityTracker або userService для збору всіх даних
  const totalDays = await activityTracker.getTotalDays(tgId);
  const completedSessions = await activityTracker.getCompletedSessions(tgId);
  const currentStreak = await activityTracker.getCurrentStreak(tgId);
  const actionsCompleted = await activityTracker.getTotalActionsCompleted(tgId);
  const avgCompletionRate = await activityTracker.getAvgCompletionRate(tgId);

  // Обчислення прогресу до наступного бейджа
  let nextBadge = null;
  let nextBadgeProgress = 0;
  // Логіка вибору наступного бейджа
  const badgesOrder = ['beginner', 'week_focus', 'winner', 'transformer', 'action_hero'];
  const user = await userService.getUserByTgId(tgId);
  const currentBadges = user.badges || [];
  const nextBadgeKey = badgesOrder.find(b => !currentBadges.includes(b));
  if (nextBadgeKey) {
    nextBadge = BADGES[nextBadgeKey];
    // просте припущення для прогресу
    switch (nextBadgeKey) {
      case 'beginner': nextBadgeProgress = completedSessions > 0 ? 100 : 0; break;
      case 'week_focus': nextBadgeProgress = Math.min((currentStreak / 7) * 100, 100); break;
      case 'winner': nextBadgeProgress = Math.min(actionsCompleted / 30 * 100, 100); break;
      case 'transformer': nextBadgeProgress = Math.min((totalDays / 30) * 100, 100); break;
      case 'action_hero': nextBadgeProgress = Math.min((actionsCompleted / 100) * 100, 100); break;
      default: nextBadgeProgress = 0;
    }
  }

  return {
    totalDays,
    completedSessions,
    currentStreak,
    actionsCompleted,
    avgCompletionRate,
    nextBadge,
    nextBadgeProgress
  };
};

export default {
  BADGES,
  checkAndAwardBadges,
  showProfile
};
