// src/features/dashboard/index.js
// Головне меню та навігація - ТІЛЬКИ ІМПОРТИ З constants.js та keyboards.js

import { MESSAGES, MENU_TEXTS, DASHBOARD_MESSAGES } from '../../config/index.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import { getUserByTgId } from '../onboarding/handlers.js';

/**
 * Форматувати дату
 */
const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Показати головне меню
 */
export const showMainMenu = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx);

    const user = await getUserByTgId(tgId);
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const userName = user.fields['User Name'] || 'Користувач';
    const subscriptionStatus = user.fields['Subscription_Status'];
    const endDate = user.fields.End_Date;

    // 🆕 ЗБИРАЄМО СТАТИСТИКУ
    const stats = {
      currentStreak: user.fields.Current_Streak || 0,
      completedSessions: user.fields.Total_Sessions || 0,
      wheelCompleted: user.fields.Wheel_Completed || false,
      goalProgress: user.fields.Goal_Progress || 0
    };

    // ✅ ВИКОРИСТОВУЄМО MESSAGES з constants.js
    let message;
    if (subscriptionStatus === 'Active' && endDate) {
      message = MESSAGES.WELCOME_BACK_ACTIVE(userName, formatDate(endDate), stats);
    } else {
      message = MESSAGES.WELCOME_BACK_INACTIVE(userName, stats);
    }

    // ✅ ВИКОРИСТОВУЄМО КЛАВІАТУРУ з keyboards.js
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  } catch (error) {
    console.error('[dashboard/showMainMenu] ❌ Помилка:', error);
    await ctx.reply('Помилка завантаження меню', keyboards.mainMenuKeyboard());
  }
};

/**
 * Показати можливості бота
 */
export const showCapabilities = async (ctx) => {
  await typing(ctx);

  // ✅ ВИКОРИСТОВУЄМО DASHBOARD_MESSAGES з constants.js
  await ctx.reply(DASHBOARD_MESSAGES.CAPABILITIES, keyboards.infoMenuInline());

  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery('Можливості'); } catch {}
  }
};

/**
 * Показати інструкції
 */
export const showInstructions = async (ctx) => {
  await typing(ctx);
  
  // ✅ ВИКОРИСТОВУЄМО MENU_TEXTS з constants.js
  await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.infoMenuInline());

  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery('Інструкції'); } catch {}
  }
};

/**
 * Показати контакти
 */
export const showContact = async (ctx) => {
  await typing(ctx);
  
  // ✅ ВИКОРИСТОВУЄМО MENU_TEXTS з constants.js
  await ctx.reply(MENU_TEXTS.CONTACT, keyboards.contactMenuInline());

  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery('Контакти'); } catch {}
  }
};

/**
 * Показати допомогу
 */
export const showHelp = async (ctx) => {
  await typing(ctx);
  
  // ✅ ВИКОРИСТОВУЄМО MENU_TEXTS з constants.js
  await ctx.reply(MENU_TEXTS.HELP, keyboards.contactMenuInline());

  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery('Допомога'); } catch {}
  }
};

/**
 * Обробка callback для dashboard
 */
export const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;

  if (!data) return false;

  const dashboardCallbacks = [
    'main_menu',
    'show_capabilities',
    'instructions',
    'contact_support',
    'help'
  ];

  if (!dashboardCallbacks.includes(data)) {
    return false;
  }

  try {
    await ctx.answerCbQuery();

    switch (data) {
      case 'main_menu':
        await showMainMenu(ctx);
        break;

      case 'show_capabilities':
        await showCapabilities(ctx);
        break;

      case 'instructions':
        await showInstructions(ctx);
        break;

      case 'contact_support':
        await showContact(ctx);
        break;

      case 'help':
        await showHelp(ctx);
        break;

      default:
        return false;
    }

    return true;
  } catch (error) {
    console.error('[dashboard/handleCallback] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Обробка текстових команд з меню
 */
export const handleText = async (ctx) => {
  const text = ctx.message?.text?.trim();

  if (!text) return false;

  try {
    // ✅ ТОЧНІ ТЕКСТИ З keyboards.js
    switch (text) {
      case 'ℹ️ Інформація про бота':
        await showCapabilities(ctx);
        return true;

      case '📞 Звʼязок':  // ✅ ПРАВИЛЬНИЙ АПОСТРОФ (ʼ)
        await showContact(ctx);
        return true;

      case '❓ Допомога':
        await showHelp(ctx);
        return true;

      // ✅ ДОДАНО: Інші кнопки з mainMenuKeyboard
      case '📊 Мій прогрес та Звіти':
        await ctx.reply('📊 Функція "Мій прогрес" в розробці...', keyboards.mainMenuKeyboard());
        return true;

      case '💰 Підписка':
        await ctx.reply('💰 Функція "Підписка" в розробці...', keyboards.mainMenuKeyboard());
        return true;

      case '🤖 AI Наставник':
        await ctx.reply('🤖 Функція "AI Наставник" в розробці...', keyboards.mainMenuKeyboard());
        return true;

      case '🎯 Колесо балансу':
        await ctx.reply('🎯 Функція "Колесо балансу" в розробці...', keyboards.mainMenuKeyboard());
        return true;

      default:
        return false;
    }
  } catch (error) {
    console.error('[dashboard/handleText] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Ініціалізація модуля
 */
export default function initDashboard(bot) {
  console.log('🏠 [dashboard] Ініціалізація модуля...');
  console.log('✅ [dashboard] Модуль готовий');
}

console.log('✅ [features/dashboard] Модуль завантажено');