// src/auth/modules/auth.js - СПРОЩЕНО

import userService from '../services/userService.js';
import paymentService from '../services/paymentService.js';
import keyboards from '../../utils/keyboards.js';

// ===== ПЕРЕВІРКА СТАТУСУ КОРИСТУВАЧА =====

/**
 * Перевіряємо чи профіль незавершений
 */
const isProfileIncomplete = (user) => {
  console.log(`[auth] 🔍 isProfileIncomplete check:`, {
    userExists: !!user,
    hasName: !!user?.['User Name'],
    hasEmail: !!user?.Email,
    status: user?.Status,
    userRegistered: user?.UserRegistered
  });
  
  if (!user) {
    console.log(`[auth] ❌ isProfileIncomplete: користувач відсутній`);
    return true;
  }
  
  const hasBasicData = !!user['User Name'] && !!user['Email'];
  const isRegistered = user.Status === 'Registered User' || user.UserRegistered === true;
  
  const incomplete = !(hasBasicData && isRegistered);
  console.log(`[auth] 📊 isProfileIncomplete результат:`, {
    hasBasicData,
    isRegistered, 
    incomplete
  });
  
  return incomplete;
};

// ===== ГОЛОВНИЙ ОБРОБНИК /start (ЧЕРЕЗ startHandler) =====

/**
 * Головний обробник команди /start - використовується startHandler.js
 */
export const handleStart = async (ctx) => {
  // Цей метод не використовується, оскільки логіка перенесена в startHandler.js
  console.log(`[auth] ℹ️ handleStart викликано, але використовується startHandler.js`);
  
  const startHandler = await import('../../controllers/handlers/startHandler.js');
  return startHandler.default.handle(ctx);
};

/**
 * Обробка кроків реєстрації - використовується startHandler.js
 */
export const handleRegistrationStep = async (ctx) => {
  // Цей метод не використовується, оскільки логіка перенесена в startHandler.js
  console.log(`[auth] ℹ️ handleRegistrationStep викликано, але використовується startHandler.js`);
  
  const startHandler = await import('../../controllers/handlers/startHandler.js');
  return startHandler.default.handleText(ctx);
};

/**
 * Обробка callback онбордингу - використовується startHandler.js
 */
export const handleOnboardingCallback = async (ctx) => {
  // Цей метод не використовується, оскільки логіка перенесена в startHandler.js
  console.log(`[auth] ℹ️ handleOnboardingCallback викликано, але використовується startHandler.js`);
  
  const startHandler = await import('../../controllers/handlers/startHandler.js');
  return startHandler.default.handleCallback(ctx);
};

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====

const showSubscriptionRequired = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `👋 З поверненням, ${userName}!\n\n` +
    `💡 Для повного доступу потрібна активна підписка:\n\n` +
    `🎯 AI коучинг 24/7\n` +
    `📊 Колесо балансу\n` +
    `📈 Персональна аналітика\n\n` +
    `💰 Активуй підписку:`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
        [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
      ]
    }
  });
};

const showMainMenu = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  const status = user?.['Active_Subscription_Status'] || '✅ Активна';
  
  const message = 
    `🏠 Головне меню\n\n` +
    `👋 ${userName}\n` +
    `${status}\n\n` +
    `Готова до продуктивного дня?`;

  await ctx.reply(message, keyboards.mainMenuKeyboard());
  
  // Оновлюємо активність в фоні
  userService.updateUser(ctx.from.id, { 
    Last_Activity: new Date().toISOString() 
  }).catch(error => console.warn('Помилка оновлення активності:', error));
};

// ===== ЕКСПОРТ =====
export default {
  handleStart,
  handleRegistrationStep,
  handleOnboardingCallback,
  isProfileIncomplete,
  showSubscriptionRequired,
  showMainMenu
};

console.log('✅ [auth] Спрощений модуль авторизації ініціалізовано');