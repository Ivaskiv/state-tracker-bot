// src/controllers/handlers/callbackHandler.js
import antiSpam from '../../utils/antiSpam.js';
import createCallbackRouter from '../../utils/callbackRouter.js';
import sendModule from '../../utils/send.js';
const send = (sendModule && (typeof sendModule === 'function')) ? sendModule : (sendModule && sendModule.send) ? sendModule.send : null;

import { handleCallback as startCb } from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../flows/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import keyboards from '../../utils/keyboards.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS } from '../../config/constants.js';

// Створюємо роутер
const router = createCallbackRouter({ autoAnswer: false });

// ---------- ROUTES ----------

// 1) main menu
router.register(['main_menu', 'open_main'], async (ctx) => {
  try {
    if (send) {
      await send(
        ctx,
        '🏠 ГОЛОВНЕ МЕНЮ\n\nОбери дію нижче 👇',
        keyboards.mainMenuInline(),
        { allow_edit_fallback: true }
      );
    } else {
      await ctx.reply(
        '🏠 ГОЛОВНЕ МЕНЮ\n\nОбери дію нижче 👇',
        { reply_markup: keyboards.mainMenuInline() }
      );
    }
    return true;
  } catch (e) {
    console.error('[callbackHandler][main_menu] error', e);
    return true;
  }
});

// 2) info menu
router.register('info_menu', async (ctx) => {
  if (send) await send(ctx, 'ℹ️ ІНФОРМАЦІЯ ПРО БОТА\n\nОбери розділ:', keyboards.infoMenuInline());
  else await ctx.reply('ℹ️ ІНФОРМАЦІЯ ПРО БОТА\n\nОбери розділ:', keyboards.infoMenuInline());
  return true;
});

// 3) subscription menu
router.register('subscription_info', async (ctx) => {
  if (send) await send(ctx, '💰 ПІДПИСКА\n\nОбери дію:', keyboards.subscriptionMenuInline());
  else await ctx.reply('💰 ПІДПИСКА\n\nОбери дію:', keyboards.subscriptionMenuInline());
  return true;
});

// 4) contact
router.register('contact', async (ctx) => {
  if (send) await send(ctx, '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:', keyboards.contactMenuInline());
  else await ctx.reply('📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:', keyboards.contactMenuInline());
  return true;
});

// 5) reports
router.register('reports_menu', async (ctx) => {
  if (send) await send(ctx, '📊 ЗВІТИ\n\nОбери тип звіту:', keyboards.reportsMenuInline());
  else await ctx.reply('📊 ЗВІТИ\n\nОбери тип звіту:', keyboards.reportsMenuInline());
  return true;
});

// 6) direct report actions
['get_weekly_report','get_monthly_report','my_progress'].forEach((action) => {
  router.register(action, async (ctx) => {
    try { await mainFlowController.handleCallback(ctx, action); } catch(e) { console.error(e); }
    return true;
  });
});
router.register('wheel_stats', async (ctx) => {
  try { await wheelController.handleCallback(ctx, 'wheel_stats'); } catch(e) { console.error(e); }
  return true;
});

// 7) help/contact/affirmation/instructions
router.register('instructions', async (ctx) => {
  if (send) await send(ctx, MENU_TEXTS.INSTRUCTIONS, keyboards.contactMenuInline(), { allow_edit_fallback: true });
  else await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.contactMenuInline());
  return true;
});
router.register('contact_support', async (ctx) => {
  if (send) await send(ctx, MENU_TEXTS.CONTACT, keyboards.contactMenuInline(), { allow_edit_fallback: true });
  else await ctx.reply(MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
  return true;
});
router.register('show_affirmation', async (ctx) => {
  const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
  if (send) await send(ctx, `✨ ${affirmation}`, keyboards.contactMenuInline(), { allow_edit_fallback: true });
  else await ctx.reply(`✨ ${affirmation}`, keyboards.contactMenuInline());
  return true;
});
router.register('help', async (ctx) => {
  if (send) await send(ctx, MENU_TEXTS.HELP, keyboards.contactMenuInline(), { allow_edit_fallback: true });
  else await ctx.reply(MENU_TEXTS.HELP, keyboards.contactMenuInline());
  return true;
});

// 8) onboard
router.register(
  (data) => false, // поки пропускаємо, не блокує інші callback
  async (ctx) => false
);
// 9) daily sessions (prefix matching)
router.register({ prefix: 'start_morning' }, async (ctx) => { await dailyController.startMorningSession(ctx); return true; });
router.register({ prefix: 'start_evening' }, async (ctx) => { await dailyController.startEveningSession(ctx); return true; });

// 10) subscriptions (prefix)
router.register((d) => d.startsWith('subscription_') || d.startsWith('subscribe_') || d === 'activate_trial' || d === 'sync_subscription' || d.startsWith('plan_') || d.startsWith('renew_'),
  async (ctx) => { await subscriptionController.handleCallback(ctx); return true; }
);

// 11) wheel (prefix)
router.register({ prefix: 'wheel_' }, async (ctx, data) => { await wheelController.handleCallback(ctx, data); return true; });

// 12) ai (prefix)
router.register({ prefix: 'ai_' }, async (ctx) => { await aiMentorController.handleAIMentorCallback(ctx); return true; });

// 13) other daily actions (contains morning/evening keywords)
router.register((d) => d.includes('morning') || d.includes('evening'), async (ctx, data) => { await dailyController.handleCallback(ctx, data); return true; });

// 14) continue session
router.register('continue_session', async (ctx) => { await mainFlowController.handleCallback(ctx, 'continue_session'); return true; });

// 15) timezone pagination
router.register(/^tz_page_\d+$/, async (ctx) => {
  const page = parseInt(ctx.callbackQuery.data.split('_')[2], 10) || 0;
  try {
    await ctx.editMessageReplyMarkup(keyboards.timezoneKeyboard(page).reply_markup);
  } catch (e) {
    if (send) await send(ctx, 'Оберіть часовий пояс:', keyboards.timezoneKeyboard(page), { allow_edit_fallback: true });
    else await ctx.reply('Оберіть часовий пояс:', keyboards.timezoneKeyboard(page));
  }
  return true;
});

// 16) default handler
const defaultHandler = async (ctx) => {
  console.log(`[callbackHandler] ❓ Невідомий callback: ${ctx.callbackQuery?.data}`);
  try { await ctx.answerCbQuery('Команда не розпізнана'); } catch (e) {}
  return true;
};

// ---------- MAIN HANDLE ----------
export const handle = async (ctx) => {
  const userId = ctx.from?.id;
  const data = ctx.callbackQuery?.data || '';
  console.log(`[callbackHandler] ${data} від ${userId}`);

  // anti-spam
  if (antiSpam.isSpam(userId, data)) {
    try { await ctx.answerCbQuery('⏳ Зачекай трохи'); } catch {}
    return true;
  }

  try {
    // 1) onboard first chance
    if (await startCb(ctx)) return true;

    // 2) router
    const handled = await router.handle(ctx);
    if (handled) return true;

    // 3) default fallback
    return await defaultHandler(ctx);
  } catch (error) {
    console.error('[callbackHandler] Помилка:', error);
    if (send) {
      try { await send(ctx, '❌ Помилка. Спробуй ще раз.', keyboards.mainMenuInline(), { allow_edit_fallback: true }); } catch {}
    } else {
      try { await ctx.reply('❌ Помилка. Спробуй ще раз.', keyboards.mainMenuInline()); } catch {}
    }
    return true;
  }
};

export default { handle };
