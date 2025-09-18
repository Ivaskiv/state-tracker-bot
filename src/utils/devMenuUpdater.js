// src/utils/devMenuUpdater.js - АВТООНОВЛЕННЯ МЕНЮ ПРИ РОЗРОБЦІ

import userService from '../auth/services/userService.js';
import keyboards from './keyboards.js';
import { ANSWER_STEPS } from '../config/constants.js';

const IS_DEV = process.env.NODE_ENV !== 'production';
const MENU_UPDATE_DELAY = 2000; // 2 секунди після запуску

/**
 * Автоматичне оновлення меню для всіх користувачів при розробці
 */
export const autoUpdateMenusOnDev = async (bot) => {
  if (!IS_DEV) {
    console.log('[devMenuUpdater] ⏭️ Пропуск автооновлення - не dev режим');
    return;
  }

  console.log('[devMenuUpdater] 🔄 Запуск автооновлення меню через', MENU_UPDATE_DELAY, 'мс');
  
  setTimeout(async () => {
    try {
      await updateAllUserMenus(bot);
    } catch (error) {
      console.error('[devMenuUpdater] ❌ Помилка автооновлення:', error);
    }
  }, MENU_UPDATE_DELAY);
};

/**
 * Оновлення меню для всіх активних користувачів
 */
const updateAllUserMenus = async (bot) => {
  try {
    console.log('[devMenuUpdater] 🚀 ПОЧАТОК автооновлення меню');
    
    // Отримуємо всіх активних користувачів
    const users = await userService.getActiveUsers();
    console.log(`[devMenuUpdater] 👥 Знайдено ${users.length} активних користувачів`);
    
    if (users.length === 0) {
      console.log('[devMenuUpdater] ℹ️ Немає активних користувачів для оновлення');
      return;
    }
    
    let updated = 0;
    let failed = 0;
    
    for (const user of users) {
      const tgId = user['TG_id'];
      const userName = user['User Name'] || 'Користувач';
      
      try {
        await updateUserMenu(bot, tgId, userName);
        updated++;
        
        // Затримка між користувачами
        await new Promise(r => setTimeout(r, 500));
        
      } catch (userError) {
        console.error(`[devMenuUpdater] ❌ Помилка для користувача ${tgId}:`, userError.message);
        failed++;
      }
    }
    
    console.log(`[devMenuUpdater] ✅ ЗАВЕРШЕНО автооновлення:`);
    console.log(`- Оновлено: ${updated}`);
    console.log(`- Помилок: ${failed}`);
    
  } catch (error) {
    console.error('[devMenuUpdater] ❌ Критична помилка автооновлення:', error);
  }
};

/**
 * Оновлення меню для одного користувача
 */
const updateUserMenu = async (bot, tgId, userName) => {
  try {
    // Очищуємо стан користувача
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    // Надсилаємо повідомлення про оновлення
    const message = `🔄 DEV: Меню оновлено (перезапуск бота)\n\nПривіт, ${userName}! Меню було автоматично оновлено через зміни в коді.`;
    
    await bot.telegram.sendMessage(tgId, message, keyboards.forceUpdateKeyboard());
    
    console.log(`[devMenuUpdater] ✅ Меню оновлено для ${userName} (${tgId})`);
    
  } catch (error) {
    // Якщо користувач заблокував бота або видалив чат
    if (error.code === 403) {
      console.log(`[devMenuUpdater] ⏭️ Пропуск ${tgId} - бот заблокований користувачем`);
    } else {
      throw error;
    }
  }
};

/**
 * Команда для ручного оновлення всіх меню (тільки в dev)
 */
export const addDevMenuCommands = (bot) => {
  if (!IS_DEV) return;
  
  // Команда для оновлення всіх меню
  bot.command('updateallmenus', async (ctx) => {
    try {
      await ctx.reply('🔄 Оновлюю меню для всіх користувачів...');
      await updateAllUserMenus(bot);
      await ctx.reply('✅ Меню оновлено для всіх користувачів!');
    } catch (error) {
      console.error('[devMenuUpdater] Помилка команди updateallmenus:', error);
      await ctx.reply('❌ Помилка оновлення меню');
    }
  });
  
  // Команда для перевірки dev режиму
  bot.command('devinfo', async (ctx) => {
    const info = `
🛠️ DEV ІНФОРМАЦІЯ:

NODE_ENV: ${process.env.NODE_ENV || 'не встановлено'}
IS_DEV: ${IS_DEV ? 'ТАК' : 'НІ'}
Автооновлення: ${IS_DEV ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}

📋 Доступні dev команди:
/updateallmenus - оновити меню всім
/updatemenu - оновити своє меню
/devinfo - ця інформація
`;
    
    await ctx.reply(info);
  });
  
  console.log('[devMenuUpdater] ✅ Dev команди додано');
};

/**
 * Швидке оновлення меню при зміні коду
 */
export const quickMenuUpdate = async (bot, specificUserId = null) => {
  if (!IS_DEV) return;
  
  try {
    if (specificUserId) {
      // Оновлюємо для конкретного користувача
      const user = await userService.getUserByTelegramId(specificUserId);
      if (user) {
        await updateUserMenu(bot, specificUserId, user['User Name']);
        console.log(`[devMenuUpdater] ⚡ Швидке оновлення для ${specificUserId}`);
      }
    } else {
      // Оновлюємо для всіх
      await updateAllUserMenus(bot);
      console.log('[devMenuUpdater] ⚡ Швидке оновлення для всіх');
    }
  } catch (error) {
    console.error('[devMenuUpdater] ❌ Помилка швидкого оновлення:', error);
  }
};
