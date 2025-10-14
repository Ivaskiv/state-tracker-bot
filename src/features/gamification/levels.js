// src/features/gamification/levels.js
// Система рівнів та прогресу

import { getBase, tables } from '../../config/database.js';
import { PROGRESS_LEVELS, getProgressLevel } from '../../config/constants.js';

const base = getBase();

/**
 * Отримати поточний рівень користувача
 */
export const getUserLevel = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
        fields: ['Total_Points', 'Current_Level']
      })
      .firstPage();

    if (records.length === 0) {
      return {
        level: PROGRESS_LEVELS.NOVICE,
        totalPoints: 0,
        nextLevel: PROGRESS_LEVELS.APPRENTICE,
        progress: 0
      };
    }

    const user = records[0].fields;
    const totalPoints = user.Total_Points || 0;
    const levelData = getProgressLevel(totalPoints);

    return {
      level: levelData,
      totalPoints,
      nextLevel: levelData.nextLevel,
      progress: levelData.progress
    };

  } catch (error) {
    console.error('[levels/getUserLevel] ❌ Помилка:', error);
    return {
      level: PROGRESS_LEVELS.NOVICE,
      totalPoints: 0,
      nextLevel: PROGRESS_LEVELS.APPRENTICE,
      progress: 0
    };
  }
};

/**
 * Додати бали користувачу
 */
export const addPoints = async (tgId, points, reason = '') => {
  try {
    console.log(`[levels/addPoints] ➕ Додаємо ${points} балів для ${tgId} (${reason})`);

    const formula = `{TG_id} = "${tgId}"`;
    const records = await base(tables.USERS)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) {
      console.error('[levels/addPoints] ❌ Користувач не знайдений');
      return false;
    }

    const user = records[0];
    const currentPoints = user.fields.Total_Points || 0;
    const newPoints = currentPoints + points;

    // Визначаємо старий та новий рівень
    const oldLevel = getProgressLevel(currentPoints);
    const newLevel = getProgressLevel(newPoints);

    // Оновлюємо бали
    await base(tables.USERS).update(user.id, {
      Total_Points: newPoints,
      Current_Level: newLevel.level,
      Last_Points_Added: new Date().toISOString()
    });

    console.log(`[levels/addPoints] ✅ Додано ${points} балів (всього: ${newPoints})`);

    // Перевіряємо чи підвищився рівень
    const leveledUp = oldLevel.level < newLevel.level;

    return {
      success: true,
      points,
      totalPoints: newPoints,
      oldLevel: oldLevel,
      newLevel: newLevel,
      leveledUp
    };

  } catch (error) {
    console.error('[levels/addPoints] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Перевірити та оновити рівень
 */
export const checkLevelUp = async (tgId, bot = null) => {
  try {
    const { level, totalPoints, nextLevel } = await getUserLevel(tgId);

    if (!nextLevel) {
      console.log(`[levels/checkLevelUp] ℹ️ Користувач на максимальному рівні`);
      return null;
    }

    // Перевіряємо чи досяг наступного рівня
    if (totalPoints >= nextLevel.pointsRequired) {
      console.log(`[levels/checkLevelUp] 🎉 LEVEL UP для ${tgId}!`);

      // Оновлюємо рівень в базі
      const formula = `{TG_id} = "${tgId}"`;
      const records = await base(tables.USERS)
        .select({ filterByFormula: formula, maxRecords: 1 })
        .firstPage();

      if (records.length > 0) {
        await base(tables.USERS).update(records[0].id, {
          Current_Level: nextLevel.level
        });
      }

      // Відправляємо повідомлення про підвищення рівня
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
          console.error('[levels/checkLevelUp] ❌ Помилка відправки:', sendError);
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
    console.error('[levels/checkLevelUp] ❌ Помилка:', error);
    return null;
  }
};

/**
 * Форматувати повідомлення про підвищення рівня
 */
const formatLevelUpMessage = (newLevel, totalPoints) => {
  return (
    `🎉 **ПІДВИЩЕННЯ РІВНЯ!**\n\n` +
    `${newLevel.icon} **${newLevel.userName}**\n\n` +
    `💰 Всього балів: ${totalPoints}\n` +
    `📊 Рівень: ${newLevel.level}\n\n` +
    `🔥 Ти робиш неймовірний прогрес! Продовжуй у тому ж дусі!`
  );
};

/**
 * Показати прогрес користувача
 */
export const showProgress = async (tgId) => {
  try {
    const { level, totalPoints, nextLevel, progress } = await getUserLevel(tgId);

    // Прогрес-бар
    const filledBlocks = Math.floor(progress / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    let message = 
      `📊 **МІЙ ПРОГРЕС**\n\n` +
      `${level.icon} **${level.userName}** (Рівень ${level.level})\n` +
      `💰 Балів: ${totalPoints}\n\n`;

    if (nextLevel) {
      message += 
        `🎯 **До наступного рівня:**\n` +
        `${progressBar} ${progress}%\n` +
        `${nextLevel.icon} ${nextLevel.userName} — ${nextLevel.pointsRequired} балів\n` +
        `Залишилось: ${nextLevel.pointsRequired - totalPoints} балів\n\n`;
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
    console.error('[levels/showProgress] ❌ Помилка:', error);
    return {
      message: '❌ Помилка завантаження прогресу',
      level: null,
      totalPoints: 0
    };
  }
};

/**
 * Отримати топ користувачів за балами
 */
export const getLeaderboard = async (limit = 10) => {
  try {
    const records = await base(tables.USERS)
      .select({
        fields: ['TG_id', 'User Name', 'Total_Points', 'Current_Level'],
        sort: [{ field: 'Total_Points', direction: 'desc' }],
        maxRecords: limit,
        filterByFormula: '{Total_Points} > 0'
      })
      .firstPage();

    return records.map((record, index) => ({
      rank: index + 1,
      tgId: record.fields.TG_id,
      userName: record.fields['User Name'] || 'Користувач',
      points: record.fields.Total_Points || 0,
      level: record.fields.Current_Level || 1
    }));

  } catch (error) {
    console.error('[levels/getLeaderboard] ❌ Помилка:', error);
    return [];
  }
};

/**
 * Форматувати таблицю лідерів
 */
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
    console.error('[levels/formatLeaderboard] ❌ Помилка:', error);
    return '❌ Помилка завантаження таблиці лідерів';
  }
};

export default {
  getUserLevel,
  addPoints,
  checkLevelUp,
  showProgress,
  getLeaderboard,
  formatLeaderboard
};

console.log('✅ [gamification/levels] Levels система завантажено');