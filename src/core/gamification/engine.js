// src/core/gamification/engine.js
import { 
  syncToTilda, 
  syncPointsUpdate, 
  syncBadgeAwarded, 
  syncStreakUpdate, 
  syncLevelUp 
} from './sync.js';

import { getBase, tables } from '../../config/database.js';

const base = getBase();

// ===== CACHE (щоб не запитувати Airtable кожен раз) =====
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

// ===== HELPER: Отримати юзера з cache =====
const getUserByTgId = async (tgId) => {
  const cached = userCache.get(tgId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const records = await base(tables.USERS)
    .select({
      filterByFormula: `{TG_id} = "${tgId}"`,
      maxRecords: 1
    })
    .firstPage();

  const user = records[0];
  if (user) {
    userCache.set(tgId, { data: user, timestamp: Date.now() });
  }
  return user;
};

// ===== HELPER: Оновити поля юзера =====
const updateUserFields = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) return false;

  await base(tables.USERS).update(user.id, fields);
  
  // Очищаємо cache
  userCache.delete(tgId);
  
  return true;
};

// ===== CALCULATE LEVEL =====
export const calculateLevel = (points) => {
  if (points < 100) return 1;
  if (points < 500) return 2;
  if (points < 1000) return 3;
  if (points < 2000) return 4;
  if (points < 5000) return 5;
  return 6;
};

// ===== GET PROGRESS LEVEL (для sync.js) =====
export const getProgressLevel = (points) => {
  const level = calculateLevel(points);
  return {
    level,
    points,
    icon: ['🌱', '📚', '🎓', '💼', '🎯', '👑'][level - 1],
    name: ['Новачок', 'Учень', 'Студент', 'Практик', 'Експерт', 'Майстер'][level - 1]
  };
};
// ===== ADD POINTS (ОПТИМІЗОВАНО) =====
export const addPoints = async (tgId, points, reason = '') => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) return { error: 'User not found' };

    const currentPoints = user.fields.Total_Points || 0;
    const newPoints = currentPoints + points;
    
    const oldLevel = calculateLevel(currentPoints);
    const newLevel = calculateLevel(newPoints);
    const levelUp = newLevel > oldLevel;
    
    // Одна операція оновлення замість двох
    const updateData = {
      Total_Points: newPoints,
      Level: newLevel,
      Last_Points_Earned: new Date().toISOString()
    };

    await updateUserFields(tgId, updateData);
    
    // Синхронізуємо (без await - асинхронно)
    syncPointsUpdate(tgId, points, reason).catch(e => 
      console.error('[addPoints/syncPoints]', e)
    );
    
    if (levelUp) {
      syncLevelUp(tgId, newLevel).catch(e => 
        console.error('[addPoints/syncLevel]', e)
      );
    }
    
    return { 
      success: true,
      newPoints, 
      newLevel, 
      levelUp 
    };

  } catch (error) {
    console.error('[engine/addPoints]', error);
    return { error: error.message };
  }
};

// ===== AWARD BADGE (ОПТИМІЗОВАНО) =====
export const checkAndAwardBadge = async (tgId, badgeKey, bot = null) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) return { success: false, error: 'User not found' };

    const badges = (user.fields.Badges || '')
      .split(',')
      .map(b => b.trim())
      .filter(Boolean);
    
    // Уже є бейдж
    if (badges.includes(badgeKey)) {
      return { success: false, alreadyHas: true };
    }

    // Конст бейджів - потрібно імпортувати
    const BADGES = await getBadgesConfig(); // Див. нижче
    const badge = Object.values(BADGES).find(b => b.key === badgeKey);
    
    if (!badge) {
      return { success: false, error: 'Badge not found' };
    }

    badges.push(badgeKey);
    const currentPoints = user.fields.Total_Points || 0;
    const newPoints = currentPoints + badge.points;
    const newLevel = calculateLevel(newPoints);

    // Одна операція замість двох
    await updateUserFields(tgId, {
      Badges: badges.join(','),
      Total_Points: newPoints,
      Level: newLevel
    });

    // Синхронізуємо (без await)
    syncBadgeAwarded(tgId, badgeKey, badge).catch(e => 
      console.error('[checkAndAwardBadge/sync]', e)
    );

    // Відправляємо повідомлення (без await)
    if (bot) {
      sendBadgeMessage(bot, tgId, badge, newPoints).catch(e => 
        console.error('[checkAndAwardBadge/message]', e)
      );
    }

    return { 
      success: true, 
      badge, 
      newPoints, 
      newLevel 
    };

  } catch (error) {
    console.error('[engine/checkAndAwardBadge]', error);
    return { success: false, error: error.message };
  }
};

// ===== UPDATE STREAK (ОПТИМІЗОВАНО) =====
export const updateStreak = async (tgId) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) return { error: 'User not found' };

    const lastActivity = user.fields.Last_Activity;
    const now = new Date();
    
    let currentStreak = user.fields.Current_Streak || 0;
    let maxStreak = user.fields.Max_Streak || 0;

    if (!lastActivity) {
      currentStreak = 1;
      maxStreak = 1;
    } else {
      const last = new Date(lastActivity);
      const hoursDiff = (now - last) / 3600000;

      if (hoursDiff <= 24) {
        currentStreak += 1;
      } else if (hoursDiff > 48) {
        currentStreak = 1;
      }

      maxStreak = Math.max(currentStreak, maxStreak);
    }

    await updateUserFields(tgId, {
      Current_Streak: currentStreak,
      Max_Streak: maxStreak,
      Last_Activity: now.toISOString()
    });

    // Синхронізуємо (без await)
    syncStreakUpdate(tgId, currentStreak, maxStreak).catch(e => 
      console.error('[updateStreak/sync]', e)
    );

    return { 
      success: true,
      currentStreak, 
      maxStreak 
    };

  } catch (error) {
    console.error('[engine/updateStreak]', error);
    return { error: error.message };
  }
};

// ===== HELPER: Отримати конфіг бейджів =====
const getBadgesConfig = async () => {
  try {
    const records = await base('Badges')
      .select({ maxRecords: 100 })
      .firstPage();

    return records.reduce((acc, r) => ({
      ...acc,
      [r.fields.key]: {
        key: r.fields.key,
        title: r.fields.title,
        description: r.fields.description,
        icon: r.fields.icon,
        points: r.fields.points || 0
      }
    }), {});

  } catch (error) {
    console.error('[getBadgesConfig]', error);
    return {};
  }
};

// ===== HELPER: Відправити повідомлення про бейдж =====
const sendBadgeMessage = async (bot, tgId, badge, newPoints) => {
  const message = 
    `🎖️ **НОВИЙ БЕЙДЖ!**\n\n` +
    `${badge.icon} **${badge.title}**\n` +
    `${badge.description}\n\n` +
    `💰 +${badge.points} балів\n` +
    `📊 Всього: ${newPoints}`;

  await bot.telegram.sendMessage(tgId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🎖️ Мої бейджі', callback_data: 'show_badges' }
      ]]
    }
  });
};

// ===== CLEAR CACHE =====
export const clearUserCache = (tgId) => {
  userCache.delete(tgId);
};

export default {
  addPoints,
  checkAndAwardBadge,
  updateStreak,
  clearUserCache,
  calculateLevel,
  getProgressLevel
};