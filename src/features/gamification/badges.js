// src/features/gamification/badges.js
// Система бейджів та нагород

import { getBase, tables } from '../../config/database.js';
import { BADGES, BADGE_CRITERIA } from '../../config/index.js';

const base = getBase();

/**
 * Отримати всі бейджі користувача
 */
export const getUserBadges = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
        fields: ['Badges', 'Total_Points']
      })
      .firstPage();

    if (records.length === 0) {
      return { badges: [], totalPoints: 0 };
    }

    const user = records[0];
    const badges = user.fields.Badges 
      ? (typeof user.fields.Badges === 'string' 
          ? user.fields.Badges.split(',').map(b => b.trim())
          : user.fields.Badges)
      : [];

    return {
      badges,
      totalPoints: user.fields.Total_Points || 0
    };
  } catch (error) {
    console.error('[badges/getUserBadges] ❌ Помилка:', error);
    return { badges: [], totalPoints: 0 };
  }
};

/**
 * Перевірити чи користувач має бейдж
 */
export const hasBadge = async (tgId, badgeKey) => {
  try {
    const { badges } = await getUserBadges(tgId);
    return badges.includes(badgeKey);
  } catch (error) {
    console.error('[badges/hasBadge] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Нагородити користувача бейджем
 */
export const awardBadge = async (tgId, badgeKey) => {
  try {
    console.log(`[badges/awardBadge] 🎖️ Нагородження ${tgId} бейджем ${badgeKey}`);

    // Перевіряємо чи вже є бейдж
    if (await hasBadge(tgId, badgeKey)) {
      console.log(`[badges/awardBadge] ℹ️ Бейдж вже є у користувача`);
      return false;
    }

    const badge = BADGES[badgeKey];
    if (!badge) {
      console.error(`[badges/awardBadge] ❌ Невідомий бейдж: ${badgeKey}`);
      return false;
    }

    // Отримуємо користувача
    const formula = `{TG_id} = "${tgId}"`;
    const records = await base(tables.USERS)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) {
      console.error(`[badges/awardBadge] ❌ Користувач не знайдений`);
      return false;
    }

    const user = records[0];
    const currentBadges = user.fields.Badges 
      ? (typeof user.fields.Badges === 'string' 
          ? user.fields.Badges.split(',').map(b => b.trim())
          : user.fields.Badges)
      : [];

    const currentPoints = user.fields.Total_Points || 0;

    // Додаємо новий бейдж
    const newBadges = [...currentBadges, badge.key];
    const newPoints = currentPoints + badge.points;

    // Оновлюємо в базі
    await base(tables.USERS).update(user.id, {
      Badges: newBadges.join(','),
      Total_Points: newPoints
    });

    console.log(`[badges/awardBadge] ✅ Бейдж ${badgeKey} нагороджено (+${badge.points} балів)`);
    
    return {
      success: true,
      badge,
      totalPoints: newPoints,
      message: formatBadgeMessage(badge, newPoints)
    };

  } catch (error) {
    console.error('[badges/awardBadge] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Форматувати повідомлення про отримання бейджа
 */
const formatBadgeMessage = (badge, totalPoints) => {
  return (
    `🎖️ **НОВИЙ БЕЙДЖ ОТРИМАНО!**\n\n` +
    `${badge.icon} **${badge.title}**\n` +
    `${badge.description}\n\n` +
    `💰 +${badge.points} балів\n` +
    `📊 Всього балів: ${totalPoints}`
  );
};

/**
 * Отримати статистику для перевірки бейджів
 */
export const getUserStats = async (tgId) => {
  try {
    // 1. Основні дані користувача
    const userFormula = `{TG_id} = "${tgId}"`;
    const userRecords = await base(tables.USERS)
      .select({
        filterByFormula: userFormula,
        maxRecords: 1,
        fields: ['Current_Streak', 'Total_Sessions', 'Wheel_Completed']
      })
      .firstPage();

    if (userRecords.length === 0) {
      return null;
    }

    const user = userRecords[0].fields;

    // 2. Підрахунок активних днів (з таблиці Responses)
    const responsesFormula = `{TG_id} = "${tgId}"`;
    const responses = await base(tables.RESPONSES)
      .select({
        filterByFormula: responsesFormula,
        fields: ['Date_Response']
      })
      .all();

    const uniqueDates = new Set(responses.map(r => r.fields.Date_Response));
    const totalActiveDays = uniqueDates.size;

    // 3. Колесо балансу
    const wheelFormula = `AND({TG_id} = "${tgId}", {Status} = "Completed")`;
    const wheelRecords = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: wheelFormula })
      .all();

    const wheelBalanceCompleted = wheelRecords.length;

    // 4. Прогрес по цілях
    const goalsFormula = `AND({TG_id} = "${tgId}", {Status} = "active")`;
    const goals = await base(tables.USER_GOALS)
      .select({ filterByFormula: goalsFormula })
      .all();

    let maxGoalProgress = 0;
    let totalProgress = 0;

    goals.forEach(goal => {
      const progress = goal.fields.Progress || 0;
      totalProgress += progress;
      if (progress > maxGoalProgress) {
        maxGoalProgress = progress;
      }
    });

    const avgCompletionRate = goals.length > 0 
      ? Math.round(totalProgress / goals.length) 
      : 0;

    // 5. AI взаємодії
    const aiFormula = `{TG_id} = "${tgId}"`;
    const aiRecords = await base(tables.AI_CONVERSATIONS)
      .select({ filterByFormula: aiFormula })
      .all();

    const totalAIInteractions = aiRecords.length;

    // 6. Тижневі звіти
    const reportsFormula = `AND({TG_id} = "${tgId}", {Report_Type} = "weekly")`;
    const reports = await base(tables.USER_REPORTS)
      .select({ filterByFormula: reportsFormula })
      .all();

    const weeklyReportsCompleted = reports.length;

    return {
      currentStreak: user.Current_Streak || 0,
      totalActiveDays,
      wheelBalanceCompleted,
      maxGoalProgress,
      avgCompletionRate,
      totalAIInteractions,
      weeklyReportsCompleted,
      completedSessions: user.Total_Sessions || 0
    };

  } catch (error) {
    console.error('[badges/getUserStats] ❌ Помилка:', error);
    return null;
  }
};

/**
 * Перевірити та нагородити всіма можливими бейджами
 */
export const checkAndAwardBadges = async (tgId, bot = null) => {
  try {
    console.log(`[badges/checkAndAwardBadges] 🔍 Перевірка бейджів для ${tgId}`);

    const stats = await getUserStats(tgId);
    if (!stats) {
      console.error('[badges/checkAndAwardBadges] ❌ Не вдалося отримати статистику');
      return [];
    }

    const awardedBadges = [];

    // Перевіряємо всі бейджі
    for (const [badgeKey, badge] of Object.entries(BADGES)) {
      const criteria = BADGE_CRITERIA[badgeKey];
      
      if (!criteria) continue;

      // Перевіряємо чи користувач вже має цей бейдж
      if (await hasBadge(tgId, badge.key)) {
        continue;
      }

      // Перевіряємо умову отримання
      if (criteria.check(stats)) {
        const result = await awardBadge(tgId, badge.key);
        
        if (result && result.success) {
          awardedBadges.push(result);
          
          // Відправляємо повідомлення в бот
          if (bot) {
            try {
              await bot.telegram.sendMessage(tgId, result.message, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🎖️ Мої бейджі', callback_data: 'show_badges' }],
                    [{ text: '🏠 До меню', callback_data: 'main_menu' }]
                  ]
                }
              });
            } catch (sendError) {
              console.error('[badges/checkAndAwardBadges] ❌ Помилка відправки:', sendError);
            }
          }
        }
      }
    }

    if (awardedBadges.length > 0) {
      console.log(`[badges/checkAndAwardBadges] ✅ Нагороджено ${awardedBadges.length} бейджів`);
    } else {
      console.log(`[badges/checkAndAwardBadges] ℹ️ Нових бейджів немає`);
    }

    return awardedBadges;

  } catch (error) {
    console.error('[badges/checkAndAwardBadges] ❌ Помилка:', error);
    return [];
  }
};

/**
 * Перевірити streak та нагородити відповідні бейджі
 */
export const checkStreakBadges = async (tgId, bot = null) => {
  try {
    const stats = await getUserStats(tgId);
    if (!stats) return [];

    const awardedBadges = [];

    // 7-днів фокус
    if (stats.currentStreak >= 7 && !await hasBadge(tgId, BADGES.WEEK_FOCUS.key)) {
      const result = await awardBadge(tgId, BADGES.WEEK_FOCUS.key);
      if (result && result.success) {
        awardedBadges.push(result);
        if (bot) {
          await bot.telegram.sendMessage(tgId, result.message, { parse_mode: 'Markdown' });
        }
      }
    }

    // 14-днів послідовності
    if (stats.currentStreak >= 14 && !await hasBadge(tgId, BADGES.CONSISTENT.key)) {
      const result = await awardBadge(tgId, BADGES.CONSISTENT.key);
      if (result && result.success) {
        awardedBadges.push(result);
        if (bot) {
          await bot.telegram.sendMessage(tgId, result.message, { parse_mode: 'Markdown' });
        }
      }
    }

    return awardedBadges;

  } catch (error) {
    console.error('[badges/checkStreakBadges] ❌ Помилка:', error);
    return [];
  }
};

/**
 * Показати всі бейджі користувача
 */
export const showUserBadges = async (tgId) => {
  try {
    const { badges, totalPoints } = await getUserBadges(tgId);

    if (badges.length === 0) {
      return {
        message: 
          `🎖️ **МОЇ БЕЙДЖІ**\n\n` +
          `У тебе поки немає бейджів.\n\n` +
          `💡 Продовжуй виконувати завдання та отримуй нагороди!`,
        badges: []
      };
    }

    const badgesList = badges.map(badgeKey => {
      const badge = Object.values(BADGES).find(b => b.key === badgeKey);
      if (!badge) return null;
      return `${badge.icon} **${badge.title}** — ${badge.description}`;
    }).filter(Boolean).join('\n\n');

    return {
      message: 
        `🎖️ **МОЇ БЕЙДЖІ**\n\n` +
        `${badgesList}\n\n` +
        `💰 **Всього балів:** ${totalPoints}`,
      badges
    };

  } catch (error) {
    console.error('[badges/showUserBadges] ❌ Помилка:', error);
    return {
      message: '❌ Помилка завантаження бейджів',
      badges: []
    };
  }
};

/**
 * Отримати прогрес до наступного бейджа
 */
export const getNextBadgeProgress = async (tgId) => {
  try {
    const stats = await getUserStats(tgId);
    if (!stats) return null;

    const nextBadges = [];

    for (const [badgeKey, badge] of Object.entries(BADGES)) {
      if (await hasBadge(tgId, badge.key)) continue;

      const criteria = BADGE_CRITERIA[badgeKey];
      if (!criteria) continue;

      // Визначаємо прогрес
      let progress = 0;
      let target = 0;

      switch (criteria.field) {
        case 'currentStreak':
          progress = stats.currentStreak;
          target = badgeKey === 'week_focus' ? 7 : 14;
          break;
        case 'totalActiveDays':
          progress = stats.totalActiveDays;
          target = 30;
          break;
        case 'maxGoalProgress':
          progress = stats.maxGoalProgress;
          target = 30;
          break;
        case 'avgCompletionRate':
          progress = stats.avgCompletionRate;
          target = 50;
          break;
        case 'totalAIInteractions':
          progress = stats.totalAIInteractions;
          target = 50;
          break;
        case 'weeklyReportsCompleted':
          progress = stats.weeklyReportsCompleted;
          target = 4;
          break;
        case 'wheelBalanceCompleted':
          progress = stats.wheelBalanceCompleted;
          target = 1;
          break;
      }

      const percentage = Math.min(100, Math.round((progress / target) * 100));

      nextBadges.push({
        badge,
        progress,
        target,
        percentage
      });
    }

    // Сортуємо за прогресом (найближчі до отримання)
    nextBadges.sort((a, b) => b.percentage - a.percentage);

    return nextBadges.slice(0, 3); // Топ-3 найближчих бейджів

  } catch (error) {
    console.error('[badges/getNextBadgeProgress] ❌ Помилка:', error);
    return [];
  }
};

export default {
  getUserBadges,
  hasBadge,
  awardBadge,
  getUserStats,
  checkAndAwardBadges,
  checkStreakBadges,
  showUserBadges,
  getNextBadgeProgress
};

console.log('✅ [gamification/badges] Badges система завантажено');