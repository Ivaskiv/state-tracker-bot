// src/features/dashboard/index.js

import users from '../../services/users.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import { MENU_TEXTS, MESSAGES } from '../onboarding/constants.js';
import { startWheelBalance } from '../wheelBalance/flow.js';
import { DASHBOARD_MESSAGES } from './constantsDashboard.js';

// ── helpers ───────────────────────────────────────────────────
const formatDate = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const safeAnswerCb = async (ctx, text = '') => {
  if (ctx?.callbackQuery) {
    try { await ctx.answerCbQuery(text); } catch {}
  }
};

// ── UI: Головне меню ─────────────────────────────────────────
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

    const stats = {
      currentStreak: user.fields.Current_Streak || 0,
      completedSessions: user.fields.Total_Sessions || 0,
      wheelCompleted: user.fields.Wheel_Completed || false,
      goalProgress: user.fields.Goal_Progress || 0
    };

    const message = (subscriptionStatus === 'Active' && endDate)
      ? MESSAGES.WELCOME_BACK_ACTIVE(userName, formatDate(endDate), stats)
      : MESSAGES.WELCOME_BACK_INACTIVE(userName, stats);

    // 🔧 КРОК 1: прибрати стару клавіатуру (Telegram інакше може не оновити)
    await ctx.reply('⏳ Оновлюю меню…', {
      reply_markup: { remove_keyboard: true }
    });

    // 🔧 КРОК 2: надіслати нову клавіатуру
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  } catch (error) {
    console.error('[dashboard/showMainMenu] ❌ Помилка:', error);
    await ctx.reply('Помилка завантаження меню', keyboards.mainMenuKeyboard());
  }
};

// ── AI Mentor ─────────────────────────────────────────────────
export const startAIMentorFromText = async (ctx) => {
  try {
    const aiMentor = (await import('../aiMentor/index.js')).default;
    await aiMentor.showAIMentorChat(ctx);
  } catch (e) {
    console.error('[dashboard/startAIMentorFromText] ❌', e);
    await ctx.reply('❌ Помилка запуску AI наставника', keyboards.mainMenuKeyboard());
  }
};

// ── Wheel Balance (з тексту) ──────────────────────────────────
export const startWheelFromText = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await users.getUserByTgId(tgId);
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start', keyboards.mainMenuKeyboard());
      return;
    }

    const userName = user.fields['User Name'] || ctx.from.first_name || 'Користувач';
    const res = await startWheelBalance(tgId, userName);

    await ctx.reply(res.message, res.keyboard || keyboards.mainMenuKeyboard());
  } catch (e) {
    console.error('[dashboard/startWheelFromText] ❌', e);
    await ctx.reply('❌ Помилка запуску колеса', keyboards.mainMenuKeyboard());
  }
};

// ── Info / Help / Capabilities ────────────────────────────────
export const showCapabilities = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(DASHBOARD_MESSAGES.CAPABILITIES, keyboards.infoMenuInline(false));
    await safeAnswerCb(ctx, 'Можливості');
  } catch (e) {
    console.error('[dashboard/showCapabilities] ❌', e);
  }
};

export const showMyProgress = async (ctx) => {
  try {
    const gamification = (await import('../gamification/index.js')).default;
    await gamification.showAchievements(ctx);
  } catch (e) {
    console.error('[dashboard/showMyProgress] ❌', e);
    await ctx.reply('📊 Функція в розробці...', keyboards.mainMenuKeyboard());
  }
};

export const showInstructions = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.infoMenuInline(true));
    await safeAnswerCb(ctx, 'Інструкції');
  } catch (e) {
    console.error('[dashboard/showInstructions] ❌', e);
  }
};

export const showSubscription = async (ctx) => {
  try {
    const controller = (await import('../subscription/controller.js')).default;
    await controller.handleSubscriptionInfo(ctx);
  } catch (e) {
    console.error('[dashboard/showSubscription] ❌', e);
    await ctx.reply('💰 Функція в розробці...', keyboards.mainMenuKeyboard());
  }
};

export const showContact = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
    await safeAnswerCb(ctx, 'Контакти');
  } catch (e) {
    console.error('[dashboard/showContact] ❌', e);
  }
};

export const showHelp = async (ctx) => {
  try {
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.HELP, keyboards.contactMenuInline());
    await safeAnswerCb(ctx, 'Допомога');
  } catch (e) {
    console.error('[dashboard/showHelp] ❌', e);
  }
};

// ── Callback router (тільки свої callback-и) ──────────────────
export const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  if (!['main_menu','show_capabilities','instructions','contact_support','help'].includes(data)) {
    return false;
  }

  try {
    switch (data) {
      case 'main_menu':         await showMainMenu(ctx); break;
      case 'show_capabilities': await showCapabilities(ctx); break;
      case 'instructions':      await showInstructions(ctx); break;
      case 'contact_support':   await showContact(ctx); break;
      case 'help':              await showHelp(ctx); break;
      default: return false;
    }
    await safeAnswerCb(ctx);
    return true;
  } catch (e) {
    console.error('[dashboard/handleCallback] ❌', e);
    return false;
  }
};

// ── Text router (тільки свої кнопки/написи) ───────────────────
export const handleText = async (ctx, textRaw) => {
  const text = (textRaw ?? ctx.message?.text ?? '').trim();
  if (!text) return false;

  try {
    switch (text) {
      case 'ℹ️ Інформація про бота':  await showCapabilities(ctx);     return true;
      case '📞 Звʼязок':               await showContact(ctx);          return true;
      case '❓ Допомога':              await showHelp(ctx);             return true;
      case '🎯 Колесо балансу':       await startWheelFromText(ctx);   return true;
      case '📊 Мій прогрес та Звіти': await showMyProgress(ctx);       return true;
      case '💰 Підписка':             await showSubscription(ctx);     return true;
      case '🤖 AI Наставник':         await startAIMentorFromText(ctx);return true;
      default: return false;
    }
  } catch (e) {
    console.error('[dashboard/handleText] ❌', e);
    await ctx.reply('❌ Виникла помилка. Спробуй ще раз', keyboards.mainMenuKeyboard());
    return false;
  }
};

// ── init (порожній, щоб легко підключати як модуль) ───────────
export default function initDashboard(_bot) {
  console.log('🏠 [dashboard] Ініціалізація модуля...');
  console.log('✅ [dashboard] Модуль готовий');
}

console.log('✅ [features/dashboard] Модуль завантажено');
