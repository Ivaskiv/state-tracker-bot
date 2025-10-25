// src/features/dashboard/index.js

import * as users from '../../services/users.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import { formatDate, getDaysWord } from '../../utils/helpers.js';
import { getUserStats } from '../../services/stats.js';
import { MENU_TEXTS, MESSAGES } from '../onboarding/constants.js';
import { startWheelBalance } from '../wheelBalance/flow.js';
import { DASHBOARD_MESSAGES } from './constants.js';
import logger from '../../utils/logger.js';
import callbacks from '../../services/callbacks.js';

const safeAnswerCb = async (ctx, text = '') => {
  if (ctx?.callbackQuery) {
    try { await ctx.answerCbQuery(text); } catch {}
  }
};

export const showMainMenu = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx);

    const user = await users.getUserByTgId(tgId);
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const stats = await getUserStats(tgId);

    const wheelStatus = stats.wheelCompleted && stats.nextWheelDate
      ? `✅ Заповнено ${formatDate(stats.wheelCompletedDate)}, наступне ${formatDate(stats.nextWheelDate)}`
      : stats.wheelCompleted
      ? `✅ Заповнено`
      : `❌ Ще ні`;

    const streakText = stats.currentStreak > 0
      ? `${stats.currentStreak} ${getDaysWord(stats.currentStreak)} поспіль`
      : '—';

    const statsData = {
      wheelStatus,
      streakText,
      lastSessionDate: formatDate(stats.lastSessionDate) || 'немає даних',
      completedSessions: stats.completedSessions,
      goalProgress: stats.maxGoalProgress
    };

    const message = (stats.subscriptionStatus === 'active')
      ? MESSAGES.WELCOME_BACK_ACTIVE(
          stats.userName,
          user.fields.End_Date ? formatDate(user.fields.End_Date) : 'невідомо',
          statsData
        )
      : MESSAGES.WELCOME_BACK_INACTIVE(stats.userName, statsData);

    await ctx.reply('⏳ Оновлюю меню…', { reply_markup: { remove_keyboard: true } });
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  } catch (error) {
    logger.error('[dashboard/showMainMenu]', error);
    await ctx.reply('Помилка завантаження меню', keyboards.mainMenuKeyboard());
  }
};

export const startAIMentorFromText = async (ctx) => {
  try {
    const aiMentor = (await import('../aiMentor/index.js')).default;
    await aiMentor.showAIMentorChat(ctx);
    return true;
  } catch (e) {
    logger.error('[dashboard/startAIMentorFromText]', e);
    await ctx.reply('❌ Помилка запуску AI наставника', keyboards.mainMenuKeyboard());
    return true;
  }
};

export const startWheelFromText = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await users.getUserByTgId(tgId);
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start', keyboards.mainMenuKeyboard());
      return true;
    }

    const userName = user.fields['User Name'] || ctx.from.first_name || 'Користувач';
    const res = await startWheelBalance(tgId, userName);

    await ctx.reply(res.message, res.keyboard || keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error('[dashboard/startWheelFromText]', e);
    await ctx.reply('❌ Помилка запуску колеса', keyboards.mainMenuKeyboard());
    return true;
  }
};

export const showCapabilities = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(DASHBOARD_MESSAGES.CAPABILITIES, keyboards.infoMenuInline(false));
    await safeAnswerCb(ctx, 'Можливості');
    return true;
  } catch (e) {
    logger.error('[dashboard/showCapabilities]', e);
    return false;
  }
};

export const showMyProgress = async (ctx) => {
  try {
    const gamification = (await import('../gamification/index.js')).default;
    await gamification.showAchievements(ctx);
    return true;
  } catch (e) {
    logger.error('[dashboard/showMyProgress]', e);
    await ctx.reply('📊 Функція в розробці...', keyboards.mainMenuKeyboard());
    return true;
  }
};

export const showInstructions = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.infoMenuInline(true));
    await safeAnswerCb(ctx, 'Інструкції');
    return true;
  } catch (e) {
    logger.error('[dashboard/showInstructions]', e);
    return false;
  }
};

export const showSubscription = async (ctx) => {
  try {
    const controller = (await import('../subscription/controller.js')).default;
    await controller.handleSubscriptionInfo(ctx);
    return true;
  } catch (e) {
    logger.error('[dashboard/showSubscription]', e);
    await ctx.reply('💰 Функція в розробці...', keyboards.mainMenuKeyboard());
    return true;
  }
};

export const showContact = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
    await safeAnswerCb(ctx, 'Контакти');
    return true;
  } catch (e) {
    logger.error('[dashboard/showContact]', e);
    return false;
  }
};

export const showHelp = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.HELP, keyboards.contactMenuInline());
    await safeAnswerCb(ctx, 'Допомога');
    return true;
  } catch (e) {
    logger.error('[dashboard/showHelp]', e);
    return false;
  }
};

// export const handleCallback = async (ctx) => {
//   const data = ctx.callbackQuery?.data;
//   if (!data) return false;

//   const callbacks = {
//     'main_menu': showMainMenu,
//     'show_capabilities': showCapabilities,
//     'instructions': showInstructions,
//     'contact_support': showContact,
//     'help': showHelp
//   };

//   if (!callbacks[data]) return false;

//   try {
//     await callbacks[data](ctx);
//     await safeAnswerCb(ctx);
//     return true;
//   } catch (e) {
//     logger.error('[dashboard/handleCallback]', e);
//     return false;
//   }
// };
callbacks.on('main_menu', (ctx) => showMainMenu(ctx));
callbacks.on('show_capabilities', (ctx) => showCapabilities(ctx));
callbacks.on('instructions', (ctx) => showInstructions(ctx));
callbacks.on('contact_support', (ctx) => showContact(ctx));
callbacks.on('help', (ctx) => showHelp(ctx));

export const handleText = async (ctx) => {
  const text = (ctx.message?.text ?? '').trim();
  if (!text) return false;

  const routes = {
    '🏠 Меню': showMainMenu,
    'ℹ️ Інформація про бота': showCapabilities,
    '📞 Звʼязок': showContact,
    '❓ Допомога': showHelp,
    '🎯 Колесо балансу': startWheelFromText,
    '📊 Мій прогрес та Звіти': showMyProgress,
    '💰 Підписка': showSubscription,
    '🤖 AI Наставник': startAIMentorFromText
  };

  const handler = routes[text];
  if (!handler) return false;

  try {
    await handler(ctx);
    return true;
  } catch (e) {
    logger.error('[dashboard/handleText]', e);
    await ctx.reply('❌ Виникла помилка. Спробуй ще раз', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default function initDashboard(_bot) {
  logger.info('🏠 [dashboard] Init');
  logger.info('✅ [dashboard] Ready');
}

logger.info('✅ [features/dashboard] Loaded');