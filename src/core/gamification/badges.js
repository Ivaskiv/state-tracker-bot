// src/features/gamification/badges.js
import { getBase, tables } from '../../config/database.js';
import { BADGES, BADGE_CRITERIA } from './constants.js';
import { getUserStats } from '../../services/stats.js';

const base = getBase();

export const getUserBadges = async (tgId) => {
  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: ['Badges', 'Total_Points']
      })
      .firstPage();

    if (records.length === 0) return { badges: [], totalPoints: 0 };

    const user = records[0];
    const badges = user.fields.Badges
      ? (typeof user.fields.Badges === 'string'
          ? user.fields.Badges.split(',').map((b) => b.trim())
          : user.fields.Badges)
      : [];

    return { badges, totalPoints: user.fields.Total_Points || 0 };
  } catch (error) {
    console.error('[badges/getUserBadges]', error);
    return { badges: [], totalPoints: 0 };
  }
};

export const hasBadge = async (tgId, badgeKey) => {
  try {
    const { badges } = await getUserBadges(tgId);
    return badges.includes(badgeKey);
  } catch (error) {
    console.error('[badges/hasBadge]', error);
    return false;
  }
};

export const awardBadge = async (tgId, badgeKey) => {
  try {
    if (await hasBadge(tgId, badgeKey)) return false;

    const badge = BADGES[badgeKey];
    if (!badge) return false;

    const records = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id} = "${tgId}"`, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) return false;

    const user = records[0];
    const currentBadges = user.fields.Badges
      ? (typeof user.fields.Badges === 'string'
          ? user.fields.Badges.split(',').map((b) => b.trim())
          : user.fields.Badges)
      : [];
    const currentPoints = user.fields.Total_Points || 0;

    const newBadges = [...currentBadges, badge.key];
    const newPoints = currentPoints + badge.points;

    await base(tables.USERS).update(user.id, {
      Badges: newBadges.join(','),
      Total_Points: newPoints
    });

    return {
      success: true,
      badge,
      totalPoints: newPoints,
      message:
        `🎖️ **НОВИЙ БЕЙДЖ ОТРИМАНО!**\n\n` +
        `${badge.icon} **${badge.title}**\n` +
        `${badge.description}\n\n` +
        `💰 +${badge.points} балів\n` +
        `📊 Всього балів: ${newPoints}`
    };
  } catch (error) {
    console.error('[badges/awardBadge]', error);
    return false;
  }
};

export const checkAndAwardBadges = async (tgId, bot = null) => {
  try {
    const stats = await getUserStats(tgId);
    if (!stats) return [];

    const awardedBadges = [];
    for (const [badgeKey, badge] of Object.entries(BADGES)) {
      const criteria = BADGE_CRITERIA[badgeKey];
      if (!criteria) continue;
      if (await hasBadge(tgId, badge.key)) continue;

      if (criteria.check(stats)) {
        const result = await awardBadge(tgId, badge.key);
        if (result && result.success) {
          awardedBadges.push(result);
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
            } catch (e) {
              console.error('[badges/checkAndAwardBadges/send]', e);
            }
          }
        }
      }
    }
    return awardedBadges;
  } catch (error) {
    console.error('[badges/checkAndAwardBadges]', error);
    return [];
  }
};

export const checkStreakBadges = async (tgId, bot = null) => {
  try {
    const stats = await getUserStats(tgId);
    if (!stats) return [];

    const awardedBadges = [];

    if (stats.currentStreak >= 7 && !(await hasBadge(tgId, BADGES.WEEK_FOCUS.key))) {
      const result = await awardBadge(tgId, BADGES.WEEK_FOCUS.key);
      if (result?.success) {
        awardedBadges.push(result);
        if (bot) await bot.telegram.sendMessage(tgId, result.message, { parse_mode: 'Markdown' });
      }
    }

    if (stats.currentStreak >= 14 && !(await hasBadge(tgId, BADGES.CONSISTENT.key))) {
      const result = await awardBadge(tgId, BADGES.CONSISTENT.key);
      if (result?.success) {
        awardedBadges.push(result);
        if (bot) await bot.telegram.sendMessage(tgId, result.message, { parse_mode: 'Markdown' });
      }
    }

    return awardedBadges;
  } catch (error) {
    console.error('[badges/checkStreakBadges]', error);
    return [];
  }
};

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

    const badgesList = badges
      .map((badgeKey) => {
        const badge = Object.values(BADGES).find((b) => b.key === badgeKey);
        return badge ? `${badge.icon} **${badge.title}** — ${badge.description}` : null;
      })
      .filter(Boolean)
      .join('\n\n');

    return {
      message:
        `🎖️ **МОЇ БЕЙДЖІ**\n\n` +
        `${badgesList}\n\n` +
        `💰 **Всього балів:** ${totalPoints}`,
      badges
    };
  } catch (error) {
    console.error('[badges/showUserBadges]', error);
    return { message: '❌ Помилка завантаження бейджів', badges: [] };
  }
};

export const getNextBadgeProgress = async (tgId) => {
  try {
    const stats = await getUserStats(tgId);
    if (!stats) return null;

    const nextBadges = [];

    for (const [badgeKey, badge] of Object.entries(BADGES)) {
      if (await hasBadge(tgId, badge.key)) continue;

      const criteria = BADGE_CRITERIA[badgeKey];
      if (!criteria) continue;

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
        default:
          break;
      }

      const percentage = Math.min(100, Math.round((progress / target) * 100));
      nextBadges.push({ badge, progress, target, percentage });
    }

    nextBadges.sort((a, b) => b.percentage - a.percentage);
    return nextBadges.slice(0, 3);
  } catch (error) {
    console.error('[badges/getNextBadgeProgress]', error);
    return [];
  }
};

export default {
  getUserBadges,
  hasBadge,
  awardBadge,
  checkAndAwardBadges,
  checkStreakBadges,
  showUserBadges,
  getNextBadgeProgress
};
