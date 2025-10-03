// src/utils/menuVersion.js - ВЕРСІОНУВАННЯ МЕНЮ

import keyboards from './keyboards.js';

// ✅ ВЕРСІЯ МЕНЮ - ЗБІЛЬШУЙ ПРИ ЗМІНІ КНОПОК
const MENU_VERSION = '1.0.0';

// Кеш версій меню користувачів
const userMenuVersions = new Map();

/**
 * Перевіряє чи потрібно оновити меню для користувача
 */
export const needsMenuUpdate = (tgId) => {
  const userVersion = userMenuVersions.get(String(tgId));
  
  if (!userVersion || userVersion !== MENU_VERSION) {
    console.log(`[menuVersion] 🔄 Меню користувача ${tgId} застаріле: ${userVersion || 'none'} → ${MENU_VERSION}`);
    return true;
  }
  
  return false;
};

/**
 * Оновлює версію меню користувача
 */
export const updateUserMenuVersion = (tgId) => {
  userMenuVersions.set(String(tgId), MENU_VERSION);
  console.log(`[menuVersion] ✅ Версію меню оновлено для ${tgId}: ${MENU_VERSION}`);
};

/**
 * Тихо оновлює меню якщо потрібно (без повідомлення)
 */
export const silentMenuUpdate = async (ctx) => {
  const tgId = ctx.from.id;
  
  if (!needsMenuUpdate(tgId)) {
    return false; // Меню актуальне
  }
  
  try {
    // Просто надсилаємо оновлене меню без тексту
    await ctx.telegram.sendMessage(
      tgId,
      '🏠 Головне меню',
      keyboards.mainMenuKeyboard()
    );
    
    updateUserMenuVersion(tgId);
    console.log(`[menuVersion] ✅ Меню тихо оновлено для ${tgId}`);
    return true;
  } catch (error) {
    console.error(`[menuVersion] ❌ Помилка оновлення меню:`, error);
    return false;
  }
};

/**
 * Оновлює меню при старті бота (middleware)
 */
export const menuUpdateMiddleware = () => {
  return async (ctx, next) => {
    // Перевіряємо лише для текстових повідомлень
    if (ctx.updateType === 'message' && ctx.message?.text) {
      const tgId = ctx.from.id;
      
      // Якщо це не команда /start і меню застаріле
      if (!ctx.message.text.startsWith('/') && needsMenuUpdate(tgId)) {
        await silentMenuUpdate(ctx);
      }
    }
    
    return next();
  };
};

export default {
  MENU_VERSION,
  needsMenuUpdate,
  updateUserMenuVersion,
  silentMenuUpdate,
  menuUpdateMiddleware
};

console.log(`✅ [menuVersion] Система версіонування меню ініціалізована (v${MENU_VERSION})`);