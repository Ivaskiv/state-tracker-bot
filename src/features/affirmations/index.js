// src/features/affirmations/index.js

import { MORNING_AFFIRMATIONS, EVENING_AFFIRMATIONS, GENERAL_AFFIRMATIONS } from '../../config/index.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import logger from '../../utils/logger.js';

/**
 * Отримати випадкову афірмацію
 */
const getRandomAffirmation = (type = 'general') => {
  let list = GENERAL_AFFIRMATIONS;
  
  if (type === 'morning') list = MORNING_AFFIRMATIONS;
  if (type === 'evening') list = EVENING_AFFIRMATIONS;
  
  const index = Math.floor(Math.random() * list.length);
  return list[index] || 'Ти можеш все!';
};

/**
 * Показати ранкову афірмацію
 */
const showMorningAffirmation = async (ctx) => {
  try {
    await typing(ctx);
    
    const affirmation = getRandomAffirmation('morning');
    
    await ctx.reply(
      `🌞 **РАНКОВА АФІРМАЦІЯ**\n\n"${affirmation}"\n\n💪 Почни день з силою!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Наступна', callback_data: 'next_morning_affirmation' }],
            [{ text: '🌞 Почати ранкову рефлексію', callback_data: 'start_morning' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    
    logger.info('[affirmations] ✅ Показана ранкова афірмація');
  } catch (error) {
    logger.error('[affirmations/showMorningAffirmation] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження афірмації', keyboards.mainMenuKeyboard());
  }
};

/**
 * Показати вечірню афірмацію
 */
const showEveningAffirmation = async (ctx) => {
  try {
    await typing(ctx);
    
    const affirmation = getRandomAffirmation('evening');
    
    await ctx.reply(
      `🌙 **ВЕЧІРНЯ АФІРМАЦІЯ**\n\n"${affirmation}"\n\n💤 Добрих снів!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Наступна', callback_data: 'next_evening_affirmation' }],
            [{ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    
    logger.info('[affirmations] ✅ Показана вечірня афірмація');
  } catch (error) {
    logger.error('[affirmations/showEveningAffirmation] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження афірмації', keyboards.mainMenuKeyboard());
  }
};

/**
 * Показати загальну афірмацію
 */
const showGeneralAffirmation = async (ctx) => {
  try {
    await typing(ctx);
    
    const affirmation = getRandomAffirmation('general');
    
    await ctx.reply(
      `💎 **АФІРМАЦІЯ**\n\n"${affirmation}"\n\n✨ Вір у себе!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Наступна', callback_data: 'next_affirmation' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    
    logger.info('[affirmations] ✅ Показана афірмація');
  } catch (error) {
    logger.error('[affirmations/showGeneralAffirmation] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження афірмації', keyboards.mainMenuKeyboard());
  }
};

/**
 * Обробка callback для афірмацій
 */
const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  
  if (!data) return false;
  
  const affirmationCallbacks = [
    'next_morning_affirmation',
    'next_evening_affirmation',
    'next_affirmation',
    'show_affirmation'
  ];
  
  if (!affirmationCallbacks.includes(data)) {
    return false;
  }
  
  try {
    await ctx.answerCbQuery();
    
    switch (data) {
      case 'next_morning_affirmation':
        await showMorningAffirmation(ctx);
        break;
      
      case 'next_evening_affirmation':
        await showEveningAffirmation(ctx);
        break;
      
      case 'next_affirmation':
      case 'show_affirmation':
        await showGeneralAffirmation(ctx);
        break;
      
      default:
        return false;
    }
    
    return true;
  } catch (error) {
    logger.error('[affirmations/handleCallback] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Ініціалізація модуля
 */
export default function initAffirmations(bot) {
  console.log('💎 [affirmations] Ініціалізація модуля...');
  console.log('✅ [affirmations] Модуль готовий');
}

// Експорт функцій
export {
  getRandomAffirmation,
  showMorningAffirmation,
  showEveningAffirmation,
  showGeneralAffirmation,
  handleCallback
};

console.log('✅ [features/affirmations] Модуль завантажено');