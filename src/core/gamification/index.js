// src/features/gamification/index.js
// Головний модуль гейміфікації

import badgesService from './badges.js';
import levelsService from './levels.js';
import rewardsService from './rewards.js';

/**
 * Показати досягнення користувача
 */
export const showAchievements = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    // Отримуємо дані
    const { level, totalPoints, nextLevel, progress } = await levelsService.getUserLevel(tgId);
    const { badges } = await badgesService.getUserBadges(tgId);

    // Прогрес-бар
    const filledBlocks = Math.floor(progress / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    // Топ-3 бейджі
    const badgesList = badges.slice(0, 3).map(badgeKey => {
      const badge = Object.values(badgesService.BADGES).find(b => b.key === badgeKey);
      return badge ? `${badge.icon} ${badge.title}` : null;
    }).filter(Boolean).join(' • ');

    let message = 
      `🏆 **МОЇ ДОСЯГНЕННЯ**\n\n` +
      `${level.icon} **${level.userName}** (Рівень ${level.level})\n` +
      `💰 Балів: ${totalPoints}\n\n`;

    if (nextLevel) {
      message += 
        `📊 **Прогрес до ${nextLevel.userName}:**\n` +
        `${progressBar} ${progress}%\n` +
        `Залишилось: ${nextLevel.pointsRequired - totalPoints} балів\n\n`;
    }

    if (badges.length > 0) {
      message += `🎖️ **Бейджі:** ${badgesList}\n`;
      if (badges.length > 3) {
        message += `   та ще ${badges.length - 3}...\n`;
      }
    } else {
      message += `🎖️ **Бейджі:** поки немає\n`;
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Детальний прогрес', callback_data: 'show_progress' },
            { text: '🎖️ Всі бейджі', callback_data: 'show_badges' }
          ],
          [
            { text: '🏆 Таблиця лідерів', callback_data: 'show_leaderboard' },
            { text: '🎁 Нагороди', callback_data: 'show_rewards' }
          ],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    });

  } catch (error) {
    console.error('[gamification/showAchievements] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження досягнень');
  }
};

/**
 * Обробка callback для гейміфікації
 */
export const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  const tgId = ctx.from.id;

  if (!data) return false;

  const gamificationCallbacks = [
    'show_achievements',
    'show_progress',
    'show_badges',
    'show_leaderboard',
    'show_rewards'
  ];

  if (!gamificationCallbacks.includes(data)) {
    return false;
  }

  try {
    await ctx.answerCbQuery();

    switch (data) {
      case 'show_achievements':
        await showAchievements(ctx);
        break;

      case 'show_progress':
        const progressResult = await levelsService.showProgress(tgId);
        await ctx.reply(progressResult.message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏆 Досягнення', callback_data: 'show_achievements' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      case 'show_badges':
        const badgesResult = await badgesService.showUserBadges(tgId);
        await ctx.reply(badgesResult.message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏆 Досягнення', callback_data: 'show_achievements' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      case 'show_leaderboard':
        const leaderboard = await levelsService.formatLeaderboard(10);
        await ctx.reply(leaderboard, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏆 Мої досягнення', callback_data: 'show_achievements' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      case 'show_rewards':
        const rewards = rewardsService.showRewards();
        await ctx.reply(rewards, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏆 Досягнення', callback_data: 'show_achievements' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      default:
        return false;
    }

    return true;

  } catch (error) {
    console.error('[gamification/handleCallback] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Обробка текстових команд
 */
export const handleText = async (ctx) => {
  const text = ctx.message?.text?.trim();

  if (!text) return false;

  // Поки немає текстових команд для гейміфікації
  return false;
};

/**
 * Ініціалізація модуля
 */
export default function initGamification(bot) {
  console.log('🎮 [gamification] Ініціалізація модуля...');
  console.log('✅ [gamification] Модуль готовий');
}

// Експорт сервісів
export { badgesService, levelsService, rewardsService };

console.log('✅ [features/gamification] Модуль завантажено');