// src/features/dashboard/index.js

import * as users from '../../services/users.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import { formatDate, getDaysWord } from '../../utils/helpers.js';
import { getUserStats } from '../../services/stats.js';
import { MENU_TEXTS, MESSAGES } from '../registration/constants.js';
import { startWheelBalance } from '../wheelBalance/flow.js';
import { DASHBOARD_MESSAGES } from './constants.js';
import logger from '../../utils/logger.js';

// ===== CALLBACK REGISTRY (замість callbacks.js) =====
const callbackRegistry = new Map();

export const registerCallback = (action, handler) => {
  callbackRegistry.set(action, handler);
};

export const handleCallback = async (ctx, action) => {
  const handler = callbackRegistry.get(action);
  if (handler) {
    try {
      await handler(ctx);
    } catch (error) {
      logger.error(`[dashboard/callback/${action}]`, error);
    }
  }
};

// ===== HELPERS =====

const safeAnswerCb = async (ctx, text = '') => {
  if (ctx?.callbackQuery) {
    try { 
      await ctx.answerCbQuery(text); 
    } catch {}
  }
};

// ===== MAIN MENU =====

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

    if (!stats.wheelCompleted) {
      const wheelCTAMessage = 
        `🎡 **КОЛЕСО БАЛАНСУ** — швидка оцінка 8 сфер твого життя (5–10 хв)\n\n` +
        `📊 Визнач пріоритети на місяць і отримай AI-аналіз для кожної сфери.\n\n` +
        `🌟 Перша оцінка допоможе зрозуміти де потрібен фокус.`;
      
      await ctx.reply(wheelCTAMessage, keyboards.wheelCtaInline());
    }

  } catch (error) {
    logger.error('[dashboard/showMainMenu]', error);
    await ctx.reply('Помилка завантаження меню', keyboards.mainMenuKeyboard());
  }
};

// ===== MENU HANDLERS =====

export const startAIMentorFromText = async (ctx) => {
  try {
    const aiMentor = (await import('../aiMentor/index.js')).default;
    await aiMentor.showAIMentorChat(ctx);
  } catch (e) {
    logger.error('[dashboard/startAIMentorFromText]', e);
    await ctx.reply('❌ Помилка запуску AI наставника', keyboards.mainMenuKeyboard());
  }
};

export const startWheelFromText = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await users.getUserByTgId(tgId);
    
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start', keyboards.mainMenuKeyboard());
      return;
    }

    const userName = user.fields['User_Name'] || ctx.from.first_name || 'Користувач';
    const res = await startWheelBalance(tgId, userName);

    await ctx.reply(res.message, res.keyboard || keyboards.mainMenuKeyboard());

  } catch (e) {
    logger.error('[dashboard/startWheelFromText]', e);
    await ctx.reply('❌ Помилка запуску колеса', keyboards.mainMenuKeyboard());
  }
};

export const showWheelInfo = async (ctx) => {
  try {
    await typing(ctx);
    
    const infoMessage = 
      `🎡 **ЧОМ КОЛЕСО БАЛАНСУ?**\n\n` +
      `Життя складається з 8 ключових сфер:\n\n` +
      `❤️ Здоров'я — енергія, сон, фізкультура\n` +
      `📚 Ріст — навчання, розвиток навичок\n` +
      `👥 Стосунки — сімʼя, друзі, любов\n` +
      `💼 Карʼєра — сенс, результати, вплив\n` +
      `💰 Фінанси — дохід, заощадження, достаток\n` +
      `🎨 Дозвілля — хобі, розслаблення, радість\n` +
      `🧘 Духовність — сенс, цінності, практика\n` +
      `🏠 Оточення — дім, порядок, простір\n\n` +
      `📊 **ЧОМ ОЦІНЮВАТИ?**\n` +
      `Бачиш дисбаланс → визнаєш пріоритети → діяш → рухаєшся до гармонії 🌟\n\n` +
      `⏱ Займає 5–10 хвилин\n` +
      `🎯 Результат — конкретні рекомендації на місяць\n` +
      `📈 Оновлюй кожен місяць і відстежуй прогрес`;
    
    await ctx.reply(infoMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎡 Почати колесо', callback_data: 'wheel_start' }],
          [{ text: '⏭️ Пізніше', callback_data: 'main_menu' }]
        ]
      }
    });
    
    await safeAnswerCb(ctx, 'Інформація про колесо');

  } catch (e) {
    logger.error('[dashboard/showWheelInfo]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

export const showCapabilities = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(DASHBOARD_MESSAGES.CAPABILITIES, keyboards.infoMenuInline(false));
    await safeAnswerCb(ctx, 'Можливості');
  } catch (e) {
    logger.error('[dashboard/showCapabilities]', e);
  }
};

export const showMyProgress = async (ctx) => {
  try {
    const gamification = (await import('../../core/gamification/index.js')).default;
    await gamification.showAchievements(ctx);
  } catch (e) {
    logger.error('[dashboard/showMyProgress]', e);
    await ctx.reply('📊 Функція в розробці...', keyboards.mainMenuKeyboard());
  }
};

export const showInstructions = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.infoMenuInline(true));
    await safeAnswerCb(ctx, 'Інструкції');
  } catch (e) {
    logger.error('[dashboard/showInstructions]', e);
  }
};

export const showSubscription = async (ctx) => {
  try {
    const controller = (await import('../../core/subscription/controller.js')).default;
    await controller.handleSubscriptionInfo(ctx);
  } catch (e) {
    logger.error('[dashboard/showSubscription]', e);
    await ctx.reply('💰 Функція в розробці...', keyboards.mainMenuKeyboard());
  }
};

export const showContact = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
    await safeAnswerCb(ctx, 'Контакти');
  } catch (e) {
    logger.error('[dashboard/showContact]', e);
  }
};

export const showHelp = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.HELP, keyboards.contactMenuInline());
    await safeAnswerCb(ctx, 'Допомога');
  } catch (e) {
    logger.error('[dashboard/showHelp]', e);
  }
};

// ===== CALLBACK REGISTRATION =====

registerCallback('main_menu', showMainMenu);
registerCallback('show_capabilities', showCapabilities);
registerCallback('instructions', showInstructions);
registerCallback('contact_support', showContact);
registerCallback('help', showHelp);
registerCallback('wheel_info', showWheelInfo);

// ===== TEXT HANDLER =====

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

// ===== INIT =====

export default function initDashboard(_bot) {
  logger.info('🏠 [dashboard] Init');
  logger.info('✅ [dashboard] Ready');
}