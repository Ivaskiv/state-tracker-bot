// src/features/gamification/rewards.js
// Система нагород та винагород

import { getBase, tables } from '../../config/database.js';
import levelsService from './levels.js';
import badgesService from './badges.js';

const base = getBase();

/**
 * Нагороди за різні дії
 */
export const REWARDS = Object.freeze({
  MORNING_SESSION: {
    points: 5,
    description: 'Завершення ранкової рефлексії'
  },
  EVENING_SESSION: {
    points: 5,
    description: 'Завершення вечірньої рефлексії'
  },
  DAILY_STREAK: {
    points: 2,
    description: 'День поспіль (streak)'
  },
  WEEKLY_REPORT: {
    points: 10,
    description: 'Завершення щотижневого звіту'
  },
  MONTHLY_WHEEL: {
    points: 15,
    description: 'Проходження Колеса балансу'
  },
  GOAL_PROGRESS: {
    points: 3,
    description: 'Прогрес по цілях (за кожні 10%)'
  },
  AI_INTERACTION: {
    points: 2,
    description: 'Взаємодія з AI-наставником'
  },
  FIRST_SESSION: {
    points: 10,
    description: 'Перша сесія (бонус)'
  }
});

/**
 * Нагородити за завершення сесії
 */
export const rewardSession = async (tgId, sessionType, bot = null) => {
  try {
    console.log(`[rewards/rewardSession] 🎁 Нагорода за ${sessionType} для ${tgId}`);

    const reward = sessionType === 'morning' 
      ? REWARDS.MORNING_SESSION 
      : REWARDS.EVENING_SESSION;

    // Додаємо бали
    const result = await levelsService.addPoints(tgId, reward.points, reward.description);

    if (!result || !result.success) {
      return false;
    }

    // Перевіряємо чи це перша сесія
    const isFirstSession = await checkFirstSession(tgId);
    if (isFirstSession) {
      await levelsService.addPoints(tgId, REWARDS.FIRST_SESSION.points, REWARDS.FIRST_SESSION.description);
    }

    // Перевіряємо підвищення рівня
    await levelsService.checkLevelUp(tgId, bot);

    // Перевіряємо бейджі
    await badgesService.checkAndAwardBadges(tgId, bot);

    return {
      success: true,
      points: reward.points,
      totalPoints: result.totalPoints,
      leveledUp: result.leveledUp
    };

  } catch (error) {
    console.error('[rewards/rewardSession] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Нагородити за streak
 */
export const rewardStreak = async (tgId, streakDays, bot = null) => {
  try {
    console.log(`[rewards/rewardStreak] 🔥 Нагорода за streak ${streakDays} днів для ${tgId}`);

    // Базова нагорода за streak
    const points = REWARDS.DAILY_STREAK.points * streakDays;

    // Бонус за milestone streak (7, 14, 30 днів)
    let bonus = 0;
    if (streakDays === 7) bonus = 20;
    if (streakDays === 14) bonus = 50;
    if (streakDays === 30) bonus = 100;

    const totalPoints = points + bonus;

    await levelsService.addPoints(tgId, totalPoints, `Streak ${streakDays} днів`);
    await levelsService.checkLevelUp(tgId, bot);
    await badgesService.checkStreakBadges(tgId, bot);

    // Якщо є milestone - відправляємо повідомлення
    if (bonus > 0 && bot) {
      const message = 
        `🔥 **STREAK MILESTONE!**\n\n` +
        `${streakDays} днів поспіль!\n\n` +
        `💰 +${totalPoints} балів (бонус: +${bonus})\n\n` +
        `Неймовірна дисципліна! Продовжуй так само! 💪`;

      try {
        await bot.telegram.sendMessage(tgId, message, { parse_mode: 'Markdown' });
      } catch (sendError) {
        console.error('[rewards/rewardStreak] ❌ Помилка відправки:', sendError);
      }
    }

    return { success: true, points: totalPoints };

  } catch (error) {
    console.error('[rewards/rewardStreak] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Нагородити за Колесо балансу
 */
export const rewardWheel = async (tgId, bot = null) => {
  try {
    console.log(`[rewards/rewardWheel] 🎯 Нагорода за Колесо балансу для ${tgId}`);

    const result = await levelsService.addPoints(
      tgId, 
      REWARDS.MONTHLY_WHEEL.points, 
      REWARDS.MONTHLY_WHEEL.description
    );

    if (!result || !result.success) {
      return false;
    }

    await levelsService.checkLevelUp(tgId, bot);
    await badgesService.checkAndAwardBadges(tgId, bot);

    return {
      success: true,
      points: REWARDS.MONTHLY_WHEEL.points,
      totalPoints: result.totalPoints
    };

  } catch (error) {
    console.error('[rewards/rewardWheel] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Нагородити за щотижневий звіт
 */
export const rewardWeeklyReport = async (tgId, bot = null) => {
  try {
    console.log(`[rewards/rewardWeeklyReport] 📊 Нагорода за тижневий звіт для ${tgId}`);

    const result = await levelsService.addPoints(
      tgId, 
      REWARDS.WEEKLY_REPORT.points, 
      REWARDS.WEEKLY_REPORT.description
    );

    if (!result || !result.success) {
      return false;
    }

    await levelsService.checkLevelUp(tgId, bot);
    await badgesService.checkAndAwardBadges(tgId, bot);

    return {
      success: true,
      points: REWARDS.WEEKLY_REPORT.points,
      totalPoints: result.totalPoints
    };

  } catch (error) {
    console.error('[rewards/rewardWeeklyReport] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Нагородити за прогрес по цілях
 */
export const rewardGoalProgress = async (tgId, progressPercent, bot = null) => {
  try {
    console.log(`[rewards/rewardGoalProgress] 🎯 Нагорода за прогрес ${progressPercent}% для ${tgId}`);

    // Нагорода за кожні 10% прогресу
    const milestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    
    if (!milestones.includes(progressPercent)) {
      return false;
    }

    let points = REWARDS.GOAL_PROGRESS.points;
    
    // Бонус за досягнення 100%
    if (progressPercent === 100) {
      points = 50;
    }

    const result = await levelsService.addPoints(
      tgId, 
      points, 
      `Прогрес по цілі: ${progressPercent}%`
    );

    if (!result || !result.success) {
      return false;
    }

    await levelsService.checkLevelUp(tgId, bot);

    // Якщо 100% - відправляємо повідомлення
    if (progressPercent === 100 && bot) {
      const message = 
        `🎉 **ЦІЛЬ ДОСЯГНУТА!**\n\n` +
        `100% виконання!\n\n` +
        `💰 +${points} балів\n\n` +
        `Чудова робота! Час ставити нові цілі! 🚀`;

      try {
        await bot.telegram.sendMessage(tgId, message, { parse_mode: 'Markdown' });
      } catch (sendError) {
        console.error('[rewards/rewardGoalProgress] ❌ Помилка відправки:', sendError);
      }
    }

    return { success: true, points, totalPoints: result.totalPoints };

  } catch (error) {
    console.error('[rewards/rewardGoalProgress] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Нагородити за AI взаємодію
 */
export const rewardAIInteraction = async (tgId, bot = null) => {
  try {
    const result = await levelsService.addPoints(
      tgId, 
      REWARDS.AI_INTERACTION.points, 
      REWARDS.AI_INTERACTION.description
    );

    if (!result || !result.success) {
      return false;
    }

    // Перевіряємо milestone (кожні 10 взаємодій)
    const stats = await badgesService.getUserStats(tgId);
    if (stats && stats.totalAIInteractions % 10 === 0) {
      await badgesService.checkAndAwardBadges(tgId, bot);
    }

    return { success: true, points: REWARDS.AI_INTERACTION.points };

  } catch (error) {
    console.error('[rewards/rewardAIInteraction] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Перевірити чи це перша сесія
 */
const checkFirstSession = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    const records = await base(tables.RESPONSES)
      .select({ filterByFormula: formula })
      .all();

    return records.length === 1; // Якщо 1 запис - це перша сесія

  } catch (error) {
    console.error('[rewards/checkFirstSession] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Показати всі доступні нагороди
 */
export const showRewards = () => {
  const rewardsList = Object.entries(REWARDS)
    .map(([key, reward]) => `• ${reward.description} — **+${reward.points}** балів`)
    .join('\n');

  return (
    `🎁 **НАГОРОДИ ТА БАЛИ**\n\n` +
    `${rewardsList}\n\n` +
    `💡 Виконуй завдання та заробляй бали для підвищення рівня!`
  );
};



export const rewardRegistration = async (tgId) => {
  await levelsService.addPoints(tgId, 10, 'Реєстрація');
  await levelsService.checkLevelUp(tgId);
};

export const penalizeLifeLost = async (tgId) => {
  await levelsService.addPoints(tgId, -5, 'Втрата життя в funnel');
};
/**
 * Нагородити за завершення відео
 */

export const rewardVideoCompleted = async (tgId, videoNum) => {
  await levelsService.addPoints(tgId, 10, `Відео ${videoNum}`);
  await levelsService.checkLevelUp(tgId);
};
/**
 * Нагородити за активацію бонусу
 */

export const rewardBonus = async (tgId) => {
  await levelsService.addPoints(tgId, 50, 'Trial 7 днів');
  await levelsService.checkLevelUp(tgId);
};

export default {
  REWARDS,
  rewardSession,
  rewardStreak,
  rewardWheel,
  rewardWeeklyReport,
  rewardGoalProgress,
  rewardAIInteraction,
  showRewards,

  rewardBonus,
  rewardVideoCompleted,
  rewardRegistration,
  penalizeLifeLost,
};

console.log('✅ [gamification/rewards] Rewards система завантажено');