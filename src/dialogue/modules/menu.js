// src/dialogue/modules/menu.js
import keyboards from '../../utils/keyboards.js';
import analyticsController from '../../controllers/analyticsController.js';
import affirmationService from '../services/affirmationService.js';
import responseService from '../services/responseService.js';
import userService from '../../auth/services/userService.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import { MENU_TEXTS, MENU_MATCHERS } from '../../config/constants.js';

export async function handleMenuCommand(ctx) {
  const text = ctx.message?.text || '';
  const tgId = ctx.from.id;
  const user = await userService.getUserByTelegramId(tgId);

  if (MENU_MATCHERS.WEEKLY(text)) {
    return analyticsController.generateWeeklyReport(ctx);
  }
  if (MENU_MATCHERS.MONTHLY(text)) {
    return analyticsController.generateMonthlyReport(ctx);
  }
  if (MENU_MATCHERS.AFFIRM(text)) {
    const aff = await affirmationService.getAffirmationAndMarkUsed();
    return ctx.reply(MENU_TEXTS.AFFIRMATION(toPlainText(aff)), keyboards.mainMenuKeyboard());
  }
  if (MENU_MATCHERS.AI_Mentor(text)) {
    return aiMentorController.handleAIMentorRequest(ctx);
  }
  if (MENU_MATCHERS.PROGRESS(text)) {
    return showUserProgress(ctx, user);
  }
  if (MENU_MATCHERS.SUBSCRIPTION(text)) {
    try {
      return await showSubscriptionInfo(ctx, user);
    } catch (e) {
      console.error('[menu.showSubscriptionInfo] Помилка:', e);
      await typing(ctx);
      return ctx.reply(MENU_TEXTS.SUBSCRIPTION_UNAVAILABLE, keyboards.mainMenuKeyboard());
    }
  }
  if (MENU_MATCHERS.HELP(text)) {
    return ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
  }
  if (MENU_MATCHERS.CONTACT(text)) {
    return ctx.reply(MENU_TEXTS.CONTACT, keyboards.supportKeyboard());
  }
  if (MENU_MATCHERS.INSTRUCTIONS(text)) {
    return ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
  }
  if (MENU_MATCHERS.QUICK_OK(text)) {
    const aff = await affirmationService.getAffirmationAndMarkUsed();
    return ctx.reply(MENU_TEXTS.QUICK_SUPPORT(toPlainText(aff)), keyboards.mainMenuKeyboard());
  }

  return ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
}

async function showSubscriptionInfo(ctx, user) {
  if (!user) {
    await typing(ctx);
    return ctx.reply(MENU_TEXTS.REGISTER_FIRST);
  }

  const active = toPlainText(user['Active_Subscription_Status']);
  const plan = toPlainText(user['Active Subscription Plan']);
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

  const subscriptionText = active.includes('✅')
    ? MENU_TEXTS.SUBSCRIPTION_ACTIVE(plan, start, end)
    : MENU_TEXTS.SUBSCRIPTION_INACTIVE;

  await typing(ctx);
  return ctx.reply(subscriptionText, keyboards.mainMenuKeyboard());
}

async function showUserProgress(ctx, user) {
  if (!user) {
    await typing(ctx);
    return ctx.reply(MENU_TEXTS.REGISTER_FIRST);
  }
  try {
    const tgId = ctx.from.id;
    const records = await responseService.getUserRecords(tgId, 30);

    const totalDays = records.length;
    let morningCompleted = 0;
    let eveningCompleted = 0;

    records.forEach(({ fields = {} }) => {
      const morning =
        fields.End_m ||
        fields.Q_m_1 || fields.Q_m_2 || fields.Q_m_3 || fields.Q_m_4 || fields.Q_m_5;
      const evening =
        fields.End_e ||
        fields.Q_e_1 || fields.Q_e_2 || fields.Q_e_3 || fields.Q_e_4 || fields.Q_e_5;
      if (morning) morningCompleted++;
      if (evening) eveningCompleted++;
    });

    const progressText = MENU_TEXTS.PROGRESS(totalDays, morningCompleted, eveningCompleted);
    await typing(ctx);
    return ctx.reply(progressText, keyboards.mainMenuKeyboard());
  } catch (e) {
    console.error('[menu.showUserProgress] Помилка:', e);
    await typing(ctx);
    return ctx.reply(MENU_TEXTS.PROGRESS_UNAVAILABLE, keyboards.mainMenuKeyboard());
  }
}

function toPlainText(v) {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(toPlainText).join(', ');
  if (typeof v === 'object') {
    if (typeof v.name === 'string') return v.name;
    if (typeof v.label === 'string') return v.label;
    if (typeof v.title === 'string') return v.title;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

async function typing(ctx, delay = 800) {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, delay));
  } catch {}
}