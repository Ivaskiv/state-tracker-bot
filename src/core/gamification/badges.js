// src/features/gamification/badges.js
import { getBase, tables } from '../../config/database.js';
import { getUserStats } from '../../services/stats.js';

const base = getBase();
const badgeCache = new Map();
const userBadgeCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 хвилин

// ===== GET USER BADGES (ОПТИМІЗОВАНО) =====
export const getUserBadges = async (tgId) => {
  try {
    const cached = userBadgeCache.get(tgId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: ['Badges', 'Total_Points']
      })
      .firstPage();

    if (records.length === 0) {
      return { badges: [], totalPoints: 0 };
    }

    const user = records[0];
    const badges = (user.fields.Badges || '')
      .split(',')
      .map(b => b.trim())
      .filter(Boolean);

    const result = { 
      badges, 
      totalPoints: user.fields.Total_Points || 0 
    };

    userBadgeCache.set(tgId, { data: result, timestamp: Date.now() });
    return result;

  } catch (error) {
    console.error('[badges/getUserBadges]', error);
    return { badges: [], totalPoints: 0 };
  }
};

// ===== HAS BADGE (ОПТИМІЗОВАНО) =====
export const hasBadge = async (tgId, badgeKey) => {
  try {
    const { badges } = await getUserBadges(tgId);
    return badges.includes(badgeKey);
  } catch (error) {
    console.error('[badges/hasBadge]', error);
    return false;
  }
};

// ===== AWARD BADGE (ОПТИМІЗОВАНО) =====
export const awardBadge = async (tgId, badgeKey) => {
  try {
    if (await hasBadge(tgId, badgeKey)) {
      return { success: false, alreadyHas: true };
    }

    const badge = await getBadgeConfig(badgeKey);
    if (!badge) {
      return { success: false, error: 'Badge not found' };
    }

    const records = await base(tables.USERS)
      .select({ 
        filterByFormula: `{TG_id} = "${tgId}"`, 
        maxRecords: 1 
      })
      .firstPage();

    if (records.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = records[0];
    const currentBadges = (user.fields.Badges || '')
      .split(',')
      .map(b => b.trim())
      .filter(Boolean);
    
    const currentPoints = user.fields.Total_Points || 0;

    const newBadges = [...currentBadges, badge.key].join(',');
    const newPoints = currentPoints + badge.points;

    await base(tables.USERS).update(user.id, {
      Badges: newBadges,
      Total_Points: newPoints
    });

    // Очищаємо cache
    userBadgeCache.delete(tgId);

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
    return { success: false, error: error.message };
  }
};

// ===== CHECK AND AWARD BADGES (ОПТИМІЗОВАНО) =====
export const checkAndAwardBadges = async (tgId, badgeKey = null, bot = null) => {
  try {
    const stats = await getUserStats(tgId);
    if (!stats) return [];

    const awardedBadges = [];
    const badgesToCheck = badgeKey ? [badgeKey] : await getAllBadgeKeys();

    for (const key of badgesToCheck) {
      if (await hasBadge(tgId, key)) continue;

      const badge = await getBadgeConfig(key);
      if (!badge) continue;

      if (shouldAwardBadge(stats, badge)) {
        const result = await awardBadge(tgId, key);
        if (result.success) {
          awardedBadges.push(result);
          
          // Відправляємо без await
          if (bot) {
            sendBadgeNotification(bot, tgId, result.message).catch(e => 
              console.error('[badges/notify]', e)
            );
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

// ===== SHOW USER BADGES (ОПТИМІЗОВАНО) =====
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

    const badgesList = await Promise.all(
      badges.map(async (badgeKey) => {
        const badge = await getBadgeConfig(badgeKey);
        return badge 
          ? `${badge.icon} **${badge.title}** — ${badge.description}`
          : null;
      })
    );

    return {
      message:
        `🎖️ **МОЇ БЕЙДЖІ**\n\n` +
        `${badgesList.filter(Boolean).join('\n\n')}\n\n` +
        `💰 **Всього балів:** ${totalPoints}`,
      badges
    };

  } catch (error) {
    console.error('[badges/showUserBadges]', error);
    return { message: '❌ Помилка завантаження бейджів', badges: [] };
  }
};

// ===== HELPERS =====

const getBadgeConfig = async (badgeKey) => {
  const cached = badgeCache.get(badgeKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const records = await base('Badges')
      .select({
        filterByFormula: `{key} = "${badgeKey}"`,
        maxRecords: 1
      })
      .firstPage();

    const badge = records[0]?.fields ? {
      key: records[0].fields.key,
      title: records[0].fields.title,
      description: records[0].fields.description,
      icon: records[0].fields.icon,
      points: records[0].fields.points || 0
    } : null;

    if (badge) {
      badgeCache.set(badgeKey, { data: badge, timestamp: Date.now() });
    }

    return badge;
  } catch (error) {
    console.error('[getBadgeConfig]', error);
    return null;
  }
};

const getAllBadgeKeys = async () => {
  try {
    const records = await base('Badges')
      .select({ fields: ['key'] })
      .firstPage();

    return records.map(r => r.fields.key).filter(Boolean);
  } catch (error) {
    console.error('[getAllBadgeKeys]', error);
    return [];
  }
};

const shouldAwardBadge = (stats, badge) => {
  // Логіка перевірки умов - налаштуй під себе
  return true; // Приклад
};

const sendBadgeNotification = async (bot, tgId, message) => {
  await bot.telegram.sendMessage(tgId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎖️ Мої бейджі', callback_data: 'show_badges' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

export const clearBadgeCache = (tgId) => {
  userBadgeCache.delete(tgId);
  badgeCache.clear();
};

export default {
  getUserBadges,
  hasBadge,
  awardBadge,
  checkAndAwardBadges,
  showUserBadges,
  clearBadgeCache
};