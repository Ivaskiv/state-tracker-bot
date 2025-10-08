import antiSpam from '../../utils/antiSpam.js';
import createCallbackRouter from '../../utils/callbackRouter.js';
import keyboards from '../../utils/keyboards.js';
import { handleCallback as startCb } from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../flows/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import userService from '../../services/userService.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS } from '../../config/constants.js';

// ----------------- HELPER -----------------
const sendMessage = async (ctx, text, keyboard = null) => {
  const isCallback = !!ctx.callbackQuery;
  const replyMarkup = keyboard ? { reply_markup: keyboard } : {};

  try {
    if (isCallback) {
      try {
        await ctx.editMessageText(text, replyMarkup);
      } catch {
        await ctx.reply(text, { ...replyMarkup, ...keyboards.mainMenuKeyboard() });
      }
    } else {
      await ctx.reply(text, { ...replyMarkup, ...keyboards.mainMenuKeyboard() });
    }
  } catch (error) {
    console.error('[callbackHandler] ❌ sendMessage error:', error.message);
    await ctx.reply(text, keyboards.mainMenuKeyboard());
  }
};

const router = createCallbackRouter({ autoAnswer: true });

// ----------------- MAIN MENU -----------------
router.register(['main_menu', 'open_main'], async (ctx) => {
  console.log('[callbackHandler] 🏠 main_menu');
  await ctx.reply('🏠 ГОЛОВНЕ МЕНЮ\n\nОбери дію 👇', keyboards.mainMenuKeyboard());
  return true;
});

// ----------------- INFO MENU -----------------
router.register('info_menu', async (ctx) => {
  console.log('[callbackHandler] ℹ️ info_menu');
  await sendMessage(ctx, 'ℹ️ ІНФОРМАЦІЯ ПРО БОТА\n\nОбери розділ:', keyboards.infoMenuInline());
  return true;
});

router.register('show_capabilities', async (ctx) => {
  console.log('[callbackHandler] 📋 show_capabilities');
  const message = 
    `🤖 МОЖЛИВОСТІ AI-НАСТАВНИКА\n\n` +
    `🎯 AI Наставник 24/7\n• Персональні поради\n• Мікро-дії\n• Аналіз блоків\n\n` +
    `🎯 Колесо балансу\n• Оцінка 8 сфер\n• AI-аналіз\n• Рекомендації\n\n` +
    `📊 Аналітика\n• Щотижневі та щомісячні звіти\n• Прогрес\n\n` +
    `🌞 Щоденні питання\n• Ранок 08:00\n• Вечір 21:30\n• Авто-аналіз\n\n` +
    `💎 Мотивація\n• Афірмації\n• Підтримка`;
  await sendMessage(ctx, message, keyboards.infoMenuInline());
  return true;
});

// ----------------- SUBSCRIPTION -----------------
router.register(['subscription_info', 'subscription_status'], async (ctx) => {
  console.log('[callbackHandler] 💰 subscription_info/status');
  await subscriptionController.handleSubscriptionInfo(ctx);
  return true;
});

router.register(
  (data) => /^(subscription_|subscribe_|plan_|renew_|sync_subscription|activate_trial)/.test(data),
  async (ctx) => {
    console.log('[callbackHandler] 💰 Subscription callback');
    await subscriptionController.handleCallback(ctx);
    return true;
  }
);

// ----------------- CONTACT / HELP -----------------
router.register('contact', async (ctx) => {
  console.log('[callbackHandler] 📞 contact');
  await sendMessage(ctx, '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:', keyboards.contactMenuInline());
  return true;
});

router.register('contact_support', async (ctx) => {
  console.log('[callbackHandler] 📞 contact_support');
  await sendMessage(ctx, MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
  return true;
});

router.register('help', async (ctx) => {
  console.log('[callbackHandler] ❓ help');
  await sendMessage(ctx, MENU_TEXTS.HELP, keyboards.contactMenuInline());
  return true;
});

router.register('show_affirmation', async (ctx) => {
  console.log('[callbackHandler] 💎 show_affirmation');
  const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
  await sendMessage(ctx, `✨ ${affirmation}`, keyboards.contactMenuInline());
  return true;
});

router.register('instructions', async (ctx) => {
  console.log('[callbackHandler] 📝 instructions');
  await sendMessage(ctx, MENU_TEXTS.INSTRUCTIONS, keyboards.contactMenuInline());
  return true;
});

// ----------------- REPORTS -----------------
router.register('reports_menu', async (ctx) => {
  console.log('[callbackHandler] 📊 reports_menu');
  await sendMessage(ctx, '📊 ЗВІТИ\n\nОбери тип звіту:', keyboards.reportsMenuInline());
  return true;
});

router.register(['get_weekly_report', 'get_monthly_report'], async (ctx, data) => {
  console.log(`[callbackHandler] 📊 ${data}`);
  try {
    await mainFlowController.handleCallback(ctx, data);
  } catch (error) {
    console.error(`[callbackHandler] ❌ ${data}:`, error);
    await sendMessage(ctx, '❌ Помилка. Спробуй пізніше.', keyboards.mainMenuInline());
  }
  return true;
});

// ----------------- DAILY SESSIONS -----------------
router.register(['start_morning', 'restart_morning'], async (ctx) => {
  console.log('[callbackHandler] 🌞 morning session START');
  try {
    await dailyController.startMorningSession(ctx);
    console.log('[callbackHandler] ✅ morning session завершено');
  } catch (error) {
    console.error('[callbackHandler] ❌ morning session error:', error);
    await ctx.reply('❌ Помилка запуску ранкової сесії', keyboards.mainMenuKeyboard());
  }
  return true;
});

router.register(['start_evening', 'restart_evening', 'force_evening'], async (ctx) => {
  console.log('[callbackHandler] 🌙 evening session START');
  try {
    await dailyController.startEveningSession(ctx);
    console.log('[callbackHandler] ✅ evening session завершено');
  } catch (error) {
    console.error('[callbackHandler] ❌ evening session error:', error);
    await ctx.reply('❌ Помилка запуску вечірньої сесії', keyboards.mainMenuKeyboard());
  }
  return true;
});

router.register('skip_morning_do_evening', async (ctx) => {
  console.log('[callbackHandler] ⏭ skip morning, do evening');
  await ctx.answerCbQuery('Ранкові пропущено');
  await dailyController.startEveningSession(ctx);
  return true;
});

// Callback проміжних дій сесій (питання, кроки) - НЕ start_morning/evening!
router.register(
  (data) => {
    // Виключаємо start/restart callbacks
    if (data.startsWith('start_') || data.startsWith('restart_')) return false;
    // Тільки проміжні дії
    return data.includes('morning_') || data.includes('evening_');
  },
  async (ctx, data) => {
    console.log(`[callbackHandler] 📅 daily action: ${data}`);
    await dailyController.handleCallback(ctx, data);
    return true;
  }
);

// ----------------- WHEEL -----------------
router.register({ prefix: 'wheel_' }, async (ctx, data) => {
  console.log('[callbackHandler] 🎯 wheel_*');
  await wheelController.handleCallback(ctx, data);
  return true;
});

router.register('wheel_stats', async (ctx) => {
  console.log('[callbackHandler] 🎯 wheel_stats');
  await wheelController.handleCallback(ctx, 'wheel_stats');
  return true;
});

// ----------------- AI MENTOR -----------------
router.register({ prefix: 'ai_' }, async (ctx) => {
  console.log('[callbackHandler] 🤖 ai_*');
  await aiMentorController.handleAIMentorCallback(ctx);
  return true;
});

// ----------------- ONBOARDING -----------------
router.register(
  (data) => ['use_telegram_name','enter_custom_name','skip_email','skip_phone','activate_trial','plan_free'].includes(data),
  async (ctx) => {
    console.log('[callbackHandler] 🔄 onboarding delegated to startHandler');
    return await startCb(ctx);
  }
);

// ----------------- PROGRESS / CONTINUE -----------------
router.register('my_progress', async (ctx) => {
  console.log('[callbackHandler] 📈 my_progress');
  await mainFlowController.handleCallback(ctx, 'my_progress');
  return true;
});

router.register('continue_session', async (ctx) => {
  console.log('[callbackHandler] 🔁 continue_session');
  await mainFlowController.handleCallback(ctx, 'continue_session');
  return true;
});

// ----------------- TIMEZONE -----------------
router.register(/^tz_page_\d+$/, async (ctx, data) => {
  const page = parseInt(data.split('_')[2], 10) || 0;
  console.log(`[callbackHandler] 🌍 tz_page_${page}`);
  try {
    await ctx.editMessageReplyMarkup(keyboards.timezoneKeyboard(page).reply_markup);
  } catch {
    await sendMessage(ctx, 'Оберіть часовий пояс:', keyboards.timezoneKeyboard(page));
  }
  return true;
});

// ----------------- DISMISS -----------------
router.register(['dismiss_reminder', 'dismiss_offer'], async (ctx) => {
  console.log('[callbackHandler] ⏭ dismiss');
  await ctx.reply('✅ Зрозуміло!', keyboards.mainMenuKeyboard());
  return true;
});

// ----------------- EXIT -----------------
router.register('exit_all', async (ctx) => {
  const tgId = ctx.from.id;
  await userService.updateUserFields(tgId, { Answer_Step: 'completed' });
  await ctx.reply('🚪 Сесії завершено.', keyboards.mainMenuKeyboard());
  await ctx.answerCbQuery();
  return true;
});

// ----------------- DEFAULT HANDLER -----------------
const defaultHandler = async (ctx, data) => {
  console.log(`[callbackHandler] ❓ Невідомий callback: ${data}`);
  await ctx.reply('❓ Команда не розпізнана. Спробуй ще раз 👇', keyboards.mainMenuKeyboard());
  return true;
};

// ----------------- HANDLE EXPORT -----------------
export const handle = async (ctx) => {
  const userId = ctx.from?.id;
  const data = ctx.callbackQuery?.data || '';

  console.log(`[callbackHandler] ➡️ callback "${data}" від ${userId}`);

  if (antiSpam.isSpam(userId, data)) {
    try { await ctx.answerCbQuery('⏳ Зачекай трохи'); } catch {}
    return true;
  }

  try {
    if (await startCb(ctx)) return true;
    const handled = await router.handle(ctx);
    if (handled) return true;
    return await defaultHandler(ctx, data);
  } catch (error) {
    console.error('[callbackHandler] ❌ Критична помилка:', error);
    try {
      await ctx.reply('❌ Помилка. Спробуй /start або обери дію 👇', keyboards.mainMenuKeyboard());
    } catch {}
    return true;
  }
};

export default { handle };