// src/controllers/handlers/callbackHandler.js — ВИПРАВЛЕНО: ВСІ клавіатури видимі

import antiSpam from '../../utils/antiSpam.js';
import createCallbackRouter from '../../utils/callbackRouter.js';

// ✅ ІМПОРТ: використовуємо keyboards напряму
import keyboards from '../../utils/keyboards.js';

// ✅ ІМПОРТ: контролери
import { handleCallback as startCb } from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../flows/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS } from '../../config/constants.js';

// ✅ УНІВЕРСАЛЬНА ФУНКЦІЯ ДЛЯ ВІДПРАВКИ (edit або reply) БЕЗ ПРИХОВУВАННЯ
const sendMessage = async (ctx, text, keyboard = null, options = {}) => {
  const isCallback = !!ctx.callbackQuery;
  
  // ✅ КРИТИЧНО: завжди зберігаємо клавіатуру
  const replyMarkup = keyboard ? { reply_markup: keyboard } : {};

  try {
    if (isCallback) {
      // Спроба редагувати
      try {
        await ctx.editMessageText(text, replyMarkup);
      } catch (editError) {
        // Fallback: reply (клавіатура зберігається!)
        await ctx.reply(text, replyMarkup);
      }
    } else {
      // Звичайний reply
      await ctx.reply(text, replyMarkup);
    }
  } catch (error) {
    console.error('[callbackHandler] ❌ Помилка sendMessage:', error.message);
    
    // ✅ FALLBACK: якщо не вдалось з клавіатурою, спробуємо ще раз
    try {
      await ctx.reply(text, replyMarkup);
    } catch (finalError) {
      // Тільки в крайньому випадку - без клавіатури
      console.error('[callbackHandler] ❌ Fallback також провалився:', finalError.message);
      await ctx.reply(text);
    }
  }
};

// ✅ СТВОРЮЄМО РОУТЕР З АВТОМАТИЧНИМ answerCbQuery
const router = createCallbackRouter({ autoAnswer: true });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📋 РЕЄСТРАЦІЯ ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ ГОЛОВНЕ МЕНЮ
// ═══════════════════════════════════════════════════════════════════════════
router.register(['main_menu', 'open_main'], async (ctx) => {
  console.log('[callbackHandler] 🏠 main_menu');
  await sendMessage(
    ctx,
    '🏠 ГОЛОВНЕ МЕНЮ\n\nОбери дію 👇',
    keyboards.mainMenuInline()
  );
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ ІНФОРМАЦІЙНЕ МЕНЮ
// ═══════════════════════════════════════════════════════════════════════════
router.register('info_menu', async (ctx) => {
  console.log('[callbackHandler] ℹ️ info_menu');
  await sendMessage(
    ctx, 
    'ℹ️ ІНФОРМАЦІЯ ПРО БОТА\n\nОбери розділ:', 
    keyboards.infoMenuInline()
  );
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 3️⃣ ПІДПИСКА
// ═══════════════════════════════════════════════════════════════════════════
router.register('subscription_info', async (ctx) => {
  console.log('[callbackHandler] 💰 subscription_info');
  await sendMessage(
    ctx, 
    '💰 ПІДПИСКА\n\nОбери дію:', 
    keyboards.subscriptionMenuInline()
  );
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 4️⃣ КОНТАКТИ
// ═══════════════════════════════════════════════════════════════════════════
router.register('contact', async (ctx) => {
  console.log('[callbackHandler] 📞 contact');
  await sendMessage(
    ctx, 
    '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:', 
    keyboards.contactMenuInline()
  );
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 5️⃣ ЗВІТИ
// ═══════════════════════════════════════════════════════════════════════════
router.register('reports_menu', async (ctx) => {
  console.log('[callbackHandler] 📊 reports_menu');
  await sendMessage(
    ctx, 
    '📊 ЗВІТИ\n\nОбери тип звіту:', 
    keyboards.reportsMenuInline()
  );
  return true;
});

// ✅ Прямі дії зі звітами
router.register(['get_weekly_report', 'get_monthly_report', 'my_progress'], async (ctx, data) => {
  console.log(`[callbackHandler] 📊 ${data}`);
  try {
    await mainFlowController.handleCallback(ctx, data);
  } catch (error) {
    console.error(`[callbackHandler] ❌ ${data}:`, error);
    await sendMessage(
      ctx, 
      '❌ Помилка. Спробуй пізніше.',
      keyboards.mainMenuInline()
    );
  }
  return true;
});

router.register('wheel_stats', async (ctx) => {
  console.log('[callbackHandler] 🎯 wheel_stats');
  try {
    await wheelController.handleCallback(ctx, 'wheel_stats');
  } catch (error) {
    console.error('[callbackHandler] ❌ wheel_stats:', error);
    await sendMessage(
      ctx, 
      '❌ Помилка статистики.',
      keyboards.mainMenuInline()
    );
  }
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 6️⃣ ДОПОМОГА / АФІРМАЦІЇ / ІНСТРУКЦІЇ
// ═══════════════════════════════════════════════════════════════════════════
router.register('instructions', async (ctx) => {
  console.log('[callbackHandler] 📝 instructions');
  await sendMessage(
    ctx, 
    MENU_TEXTS.INSTRUCTIONS, 
    keyboards.contactMenuInline()
  );
  return true;
});

router.register('contact_support', async (ctx) => {
  console.log('[callbackHandler] 📞 contact_support');
  await sendMessage(
    ctx, 
    MENU_TEXTS.CONTACT, 
    keyboards.contactMenuInline()
  );
  return true;
});

router.register('show_affirmation', async (ctx) => {
  console.log('[callbackHandler] 💎 show_affirmation');
  const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
  await sendMessage(
    ctx, 
    `✨ ${affirmation}`, 
    keyboards.contactMenuInline()
  );
  return true;
});

router.register('help', async (ctx) => {
  console.log('[callbackHandler] ❓ help');
  await sendMessage(
    ctx, 
    MENU_TEXTS.HELP, 
    keyboards.contactMenuInline()
  );
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 7️⃣ ОНБОРДИНГ (делегуємо в startHandler)
// ═══════════════════════════════════════════════════════════════════════════
router.register(
  (data) => [
    'use_telegram_name', 
    'enter_custom_name', 
    'skip_email', 
    'skip_phone', 
    'activate_trial', 
    'plan_free'
  ].some(p => data.includes(p)),
  async (ctx) => {
    console.log('[callbackHandler] 🔄 Делегуємо в startHandler');
    return await startCb(ctx);
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// 8️⃣ ЩОДЕННІ СЕСІЇ (morning/evening)
// ═══════════════════════════════════════════════════════════════════════════
router.register({ prefix: 'start_morning' }, async (ctx) => {
  console.log('[callbackHandler] 🌞 start_morning');
  await dailyController.startMorningSession(ctx);
  return true;
});

router.register({ prefix: 'start_evening' }, async (ctx) => {
  console.log('[callbackHandler] 🌙 start_evening');
  await dailyController.startEveningSession(ctx);
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 9️⃣ ПІДПИСКИ (subscription_*, subscribe_*, plan_*, renew_*, sync_subscription)
// ═══════════════════════════════════════════════════════════════════════════
router.register(
  (data) => /^(subscription_|subscribe_|plan_|renew_|sync_subscription|activate_trial)/.test(data),
  async (ctx) => {
    console.log('[callbackHandler] 💰 Subscription callback');
    await subscriptionController.handleCallback(ctx);
    return true;
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// 🔟 КОЛЕСО БАЛАНСУ (wheel_*)
// ═══════════════════════════════════════════════════════════════════════════
router.register({ prefix: 'wheel_' }, async (ctx, data) => {
  console.log('[callbackHandler] 🎯 wheel_*');
  await wheelController.handleCallback(ctx, data);
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣1️⃣ AI НАСТАВНИК (ai_*)
// ═══════════════════════════════════════════════════════════════════════════
router.register({ prefix: 'ai_' }, async (ctx) => {
  console.log('[callbackHandler] 🤖 ai_*');
  await aiMentorController.handleAIMentorCallback(ctx);
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣2️⃣ ІНШІ DAILY ACTIONS (contains morning/evening keywords)
// ═══════════════════════════════════════════════════════════════════════════
router.register(
  (data) => data.includes('morning') || data.includes('evening'),
  async (ctx, data) => {
    console.log('[callbackHandler] 📅 daily action');
    await dailyController.handleCallback(ctx, data);
    return true;
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣3️⃣ CONTINUE SESSION
// ═══════════════════════════════════════════════════════════════════════════
router.register('continue_session', async (ctx) => {
  console.log('[callbackHandler] 🔁 continue_session');
  await mainFlowController.handleCallback(ctx, 'continue_session');
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣4️⃣ TIMEZONE PAGINATION (tz_page_N)
// ═══════════════════════════════════════════════════════════════════════════
router.register(/^tz_page_\d+$/, async (ctx, data) => {
  const page = parseInt(data.split('_')[2], 10) || 0;
  console.log(`[callbackHandler] 🌍 tz_page_${page}`);
  
  try {
    await ctx.editMessageReplyMarkup(keyboards.timezoneKeyboard(page).reply_markup);
  } catch {
    await sendMessage(
      ctx, 
      'Оберіть часовий пояс:', 
      keyboards.timezoneKeyboard(page)
    );
  }
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣5️⃣ DISMISS/CANCEL (не приховуємо меню!)
// ═══════════════════════════════════════════════════════════════════════════
router.register(['dismiss_reminder', 'dismiss_offer'], async (ctx) => {
  console.log('[callbackHandler] ⏭ dismiss');
  await sendMessage(
    ctx,
    '✅ Зрозуміло!',
    keyboards.mainMenuInline() // ✅ Меню залишається
  );
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣6️⃣ DEFAULT HANDLER (невідомі callbacks)
// ═══════════════════════════════════════════════════════════════════════════
const defaultHandler = async (ctx, data) => {
  console.log(`[callbackHandler] ❓ Невідомий callback: ${data}`);
  await sendMessage(
    ctx, 
    '❓ Команда не розпізнана. Спробуй ще раз 👇', 
    keyboards.mainMenuInline() // ✅ Меню завжди є
  );
  return true;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 ГОЛОВНИЙ ОБРОБНИК
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const handle = async (ctx) => {
  const userId = ctx.from?.id;
  const data = ctx.callbackQuery?.data || '';
  
  console.log(`[callbackHandler] ➡️ callback "${data}" від ${userId}`);

  // ✅ АНТІ-СПАМ
  if (antiSpam.isSpam(userId, data)) {
    try {
      await ctx.answerCbQuery('⏳ Зачекай трохи');
    } catch {}
    return true;
  }

  try {
    // 1️⃣ ПРІОРИТЕТ: onboarding (startHandler)
    if (await startCb(ctx)) {
      return true;
    }

    // 2️⃣ ROUTER
    const handled = await router.handle(ctx);
    if (handled) {
      return true;
    }

    // 3️⃣ DEFAULT FALLBACK
    return await defaultHandler(ctx, data);

  } catch (error) {
    console.error('[callbackHandler] ❌ Критична помилка:', error);
    
    // ✅ Останній fallback — З КЛАВІАТУРОЮ
    try {
      await sendMessage(
        ctx, 
        '❌ Помилка. Спробуй /start або обери дію 👇', 
        keyboards.mainMenuInline()
      );
    } catch {}
    
    return true;
  }
};

export default { handle };