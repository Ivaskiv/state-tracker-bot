// src/core/gamification/engine.js - оновлені функції
import { syncToTilda, syncPointsUpdate, syncBadgeAwarded, syncStreakUpdate, syncLevelUp } from './sync.js';

export const addPoints = async (tgId, points, reason = '') => {
  const user = await getUserByTgId(tgId);
  const currentPoints = user.fields.Total_Points || 0;
  const newPoints = currentPoints + points;
  
  const oldLevel = calculateLevel(currentPoints);
  const newLevel = calculateLevel(newPoints);
  const levelUp = newLevel > oldLevel;
  
  await updateUserFields(tgId, {
    Total_Points: newPoints,
    Level: newLevel,
    Last_Points_Earned: new Date().toISOString()
  });
  
  // Синхронізуємо поінти
  await syncPointsUpdate(tgId, points, reason);
  
  // Якщо level up - окремо синхронізуємо
  if (levelUp) {
    const levelData = Object.values(PROGRESS_LEVELS).find(l => l.level === newLevel);
    await syncLevelUp(tgId, newLevel, levelData);
  }
  
  return { newPoints, newLevel, levelUp };
};

export const checkAndAwardBadge = async (tgId, badgeKey, bot = null) => {
  const user = await getUserByTgId(tgId);
  const badges = user.fields.Badges ? user.fields.Badges.split(',').map(b => b.trim()).filter(Boolean) : [];
  
  if (badges.includes(badgeKey)) return false;
  
  const badge = Object.values(BADGES).find(b => b.key === badgeKey);
  if (!badge) return false;
  
  badges.push(badgeKey);
  
  const currentPoints = user.fields.Total_Points || 0;
  const newPoints = currentPoints + badge.points;
  
  await updateUserFields(tgId, {
    Badges: badges.join(','),
    Total_Points: newPoints
  });
  
  // Синхронізуємо бейдж
  await syncBadgeAwarded(tgId, badgeKey, badge);
  
  const message = 
    `🎖️ **НОВИЙ БЕЙДЖ!**\n\n` +
    `${badge.icon} **${badge.title}**\n` +
    `${badge.description}\n\n` +
    `💰 +${badge.points} балів\n` +
    `📊 Всього: ${newPoints}`;
  
  if (bot) {
    try {
      await bot.telegram.sendMessage(tgId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🎖️ Мої бейджі', callback_data: 'show_badges' }
          ]]
        }
      });
    } catch (e) {}
  }
  
  return true;
};

export const updateStreak = async (tgId) => {
  const user = await getUserByTgId(tgId);
  const lastActivity = user.fields.Last_Activity;
  
  if (!lastActivity) {
    await updateUserFields(tgId, { Current_Streak: 1, Max_Streak: 1 });
    await syncStreakUpdate(tgId, 1, 1);
    return 1;
  }
  
  const now = new Date();
  const last = new Date(lastActivity);
  const hoursDiff = (now - last) / 3600000;
  
  let currentStreak = user.fields.Current_Streak || 0;
  
  if (hoursDiff <= 24) {
    currentStreak += 1;
  } else if (hoursDiff > 48) {
    currentStreak = 1;
  }
  
  const maxStreak = Math.max(currentStreak, user.fields.Max_Streak || 0);
  
  await updateUserFields(tgId, {
    Current_Streak: currentStreak,
    Max_Streak: maxStreak
  });
  
  // Синхронізуємо стрік
  await syncStreakUpdate(tgId, currentStreak, maxStreak);
  
  return currentStreak;
};