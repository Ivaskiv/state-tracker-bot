// src/features/gamification/levels.js
// Система рівнів та прогресу

import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

// ===== CONSTANTS (замість констант.js) =====

const PROGRESS_LEVELS = {
  NOVICE: { level: 1, userName: 'Новачок', icon: '🌱', pointsRequired: 0, nextLevel: 2 },
  APPRENTICE: { level: 2, userName: 'Учень', icon: '📚', pointsRequired: 100, nextLevel: 3 },
  STUDENT: { level: 3, userName: 'Студент', icon: '🎓', pointsRequired: 500, nextLevel: 4 },
  PRACTITIONER: { level: 4, userName: 'Практик', icon: '💼', pointsRequired: 1000, nextLevel: 5 },
  EXPERT: { level: 5, userName: 'Експерт', icon: '🎯', pointsRequired: 2000, nextLevel: 6 },
  MASTER: { level: 6, userName: 'Майстер', icon: '👑', pointsRequired: 5000, nextLevel: null }
};

const getProgressLevel = (points) => {
  if (points < 100) return PROGRESS_LEVELS.NOVICE;
  if (points < 500) return PROGRESS_LEVELS.APPRENTICE;
  if (points < 1000) return PROGRESS_LEVELS.STUDENT;
  if (points < 2000) return PROGRESS_LEVELS.PRACTITIONER;
  if (points < 5000) return PROGRESS_LEVELS.EXPERT;
  return PROGRESS_LEVELS.MASTER;
};

// ===== CACHE =====

const levelCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const getCachedLevel = (tgId) => {
  const cached = levelCache.get(tgId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedLevel = (tgId, data) => {
  levelCache.set(tgId, { data, timestamp: Date.now() });
};

const clearCachedLevel = (tgId) => {
  levelCache.delete(tgId);
};

// ===== GET USER LEVEL =====

export const getUserLevel = async (tgId) => {
  try {
    // Перевіримо cache
    const cached = getCachedLevel(tgId);
    if (cached) return cached;

    const formula = `{TG_id} = "${tgId}"`;
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
        fields: ['Total_Points', 'Current_Level']
      })
      .firstPage();

    if (records.length === 0) {
      const result = {
        level: PROGRESS_LEVELS.NOVICE,
        totalPoints: 0,
        nextLevel: PROGRESS_LEVELS.APPRENTICE,
        progress: 0
      };
      setCachedLevel(tgId, result);
      return result;
    }

    const user = records[0].fields;
    const totalPoints = user.Total_Points || 0;
    const levelData = getProgressLevel(totalPoints);

    const nextLevel = levelData.nextLevel 
      ? PROGRESS_LEVELS[Object.keys(PROGRESS_LEVELS).find(k => 
          PROGRESS_LEVELS[k].level === levelData.nextLevel)]
      : null;

    const progress = nextLevel 
      ? Math.min(100, Math.round(((totalPoints - levelData.pointsRequired) / 
          (nextLevel.pointsRequired - levelData.pointsRequired)) * 100))
      : 100;

    const result = {
      level: levelData,
      totalPoints,
      nextLevel,
      progress
    };

    setCachedLevel(tgId, result);
    return result;

  } catch (error) {
    logger.error('[levels/getUserLevel]', error);
    return {
      level: PROGRESS_LEVELS.NOVICE,
      totalPoints: 0,
      nextLevel: PROGRESS_LEVELS.APPRENTICE,
      progress: 0
    };
  }
};

// ===== ADD POINTS =====

export const addPoints = async (tgId, points, reason = '') => {
  try {
    logger.info(`[levels/addPoints] +${points} для ${tgId} (${reason})`);

    const formula = `{TG_id} = "${tgId}"`;
    const records = await base(tables.USERS)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) {
      logger.error('[levels/addPoints] User not found');
      return { success: false, error: 'User not found' };
    }

    const user = records[0];
    const currentPoints = user.fields.Total_Points || 0;
    const newPoints = currentPoints + points;

    const oldLevel = getProgressLevel(currentPoints);
    const newLevel = getProgressLevel(newPoints);

    await base(tables.USERS).update(user.id, {
      Total_Points: newPoints,
      Current_Level: newLevel.level
    });

    clearCachedLevel(tgId);

    const leveledUp = oldLevel.level < newLevel.level;

    logger.info(`[levels/addPoints] ✅ +${points} (total: ${newPoints})${leveledUp ? ' LEVEL UP!' : ''}`);

    return {
      success: true,
      points,
      totalPoints: newPoints,
      oldLevel,
      newLevel,
      leveledUp
    };

  } catch (error) {
    logger.error('[levels/addPoints]', error);
    return { success: false, error: error.message };
  }
};

// ===== CHECK LEVEL UP =====

export const checkLevelUp = async (tgId, bot = null) => {
  try {
    const { level, totalPoints, nextLevel } = await getUserLevel(tgId);

    if (!nextLevel) {
      logger.info(`[levels/checkLevelUp] Max level reached for ${tgId}`);
      return null;
    }

    if (totalPoints >= nextLevel.pointsRequired) {
      logger.info(`[levels/checkLevelUp] LEVEL UP for ${tgId}!`);

      const formula = `{TG_id} = "${tgId}"`;
      const records = await base(tables.USERS)
        .select({ filterByFormula: formula, maxRecords: 1 })
        .firstPage();

      if (records.length > 0) {
        await base(tables.USERS).update(records[0].id, {
          Current_Level: nextLevel.level
        });
      }

      clearCachedLevel(tgId);

      if (bot) {
        const message = formatLevelUpMessage(nextLevel, totalPoints);
        
        try {
          await bot.telegram.sendMessage(tgId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎖️ Мої досягнення', callback_data: 'show_achievements' }],
                [{ text: '🏠 До меню', callback_data: 'main_menu' }]
              ]
            }
          });
        } catch (sendError) {
          logger.error('[levels/checkLevelUp/send]', sendError);
        }
      }

      return {
        success: true,
        newLevel: nextLevel,
        totalPoints
      };
    }

    return null;

  } catch (error) {
    logger.error('[levels/checkLevelUp]', error);
    return null;
  }
};

// ===== FORMAT LEVEL UP MESSAGE =====

const formatLevelUpMessage = (newLevel, totalPoints) => {
  return (
    `🎉 **ПІДВИЩЕННЯ РІВНЯ!**\n\n` +
    `${newLevel.icon} **${newLevel.userName}**\n\n` +
    `💰 Всього балів: ${totalPoints}\n` +
    `📊 Рівень: ${newLevel.level}\n\n` +
    `🔥 Ти робиш неймовірний прогрес! Продовжуй у тому ж дусі!`
  );
};

// ===== SHOW PROGRESS =====

export const showProgress = async (tgId) => {
  try {
    const { level, totalPoints, nextLevel, progress } = await getUserLevel(tgId);

    const filledBlocks = Math.floor(progress / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    let message = 
      `📊 **МІЙ ПРОГРЕС**\n\n` +
      `${level.icon} **${level.userName}** (Рівень ${level.level})\n` +
      `💰 Балів: ${totalPoints}\n\n`;

    if (nextLevel) {
      const pointsLeft = nextLevel.pointsRequired - totalPoints;
      message += 
        `🎯 **До наступного рівня:**\n` +
        `${progressBar} ${progress}%\n` +
        `${nextLevel.icon} ${nextLevel.userName} — ${nextLevel.pointsRequired} балів\n` +
        `Залишилось: ${pointsLeft} балів\n\n`;
    } else {
      message += `👑 **Ти досяг максимального рівня!**\n\n`;
    }

    message += 
      `💡 **Як заробити бали:**\n` +
      `• Виконуй щоденні сесії\n` +
      `• Отримуй бейджі\n` +
      `• Проходь Колесо балансу\n` +
      `• Взаємодій з AI-наставником`;

    return { message, level, totalPoints };

  } catch (error) {
    logger.error('[levels/showProgress]', error);
    return {
      message: '❌ Помилка завантаження прогресу',
      level: null,
      totalPoints: 0
    };
  }
};

// ===== GET LEADERBOARD =====

export const getLeaderboard = async (limit = 10) => {
  try {
    const records = await base(tables.USERS)
      .select({
        fields: ['TG_id', 'User_Name', 'Total_Points', 'Current_Level'],
        sort: [{ field: 'Total_Points', direction: 'desc' }],
        maxRecords: limit,
        filterByFormula: '{Total_Points} > 0'
      })
      .firstPage();

    return records.map((record, index) => ({
      rank: index + 1,
      tgId: record.fields.TG_id,
      userName: record.fields['User_Name'] || 'Користувач',
      points: record.fields.Total_Points || 0,
      level: record.fields.Current_Level || 1
    }));

  } catch (error) {
    logger.error('[levels/getLeaderboard]', error);
    return [];
  }
};

// ===== FORMAT LEADERBOARD =====

export const formatLeaderboard = async (limit = 10) => {
  try {
    const leaders = await getLeaderboard(limit);

    if (leaders.length === 0) {
      return '📊 Таблиця лідерів поки порожня';
    }

    const medals = ['🥇', '🥈', '🥉'];
    
    let message = `🏆 **ТАБЛИЦЯ ЛІДЕРІВ**\n\n`;

    leaders.forEach(leader => {
      const medal = leader.rank <= 3 ? medals[leader.rank - 1] : `${leader.rank}.`;
      const levelData = getProgressLevel(leader.points);
      
      message += 
        `${medal} **${leader.userName}**\n` +
        `   ${levelData.icon} ${levelData.userName} • ${leader.points} балів\n\n`;
    });

    return message;

  } catch (error) {
    logger.error('[levels/formatLeaderboard]', error);
    return '❌ Помилка завантаження таблиці лідерів';
  }
};

export default {
  getUserLevel,
  addPoints,
  checkLevelUp,
  showProgress,
  getLeaderboard,
  formatLeaderboard,
  clearCachedLevel,
  PROGRESS_LEVELS,
  getProgressLevel
};

logger.info('✅ [gamification/levels] Loaded');