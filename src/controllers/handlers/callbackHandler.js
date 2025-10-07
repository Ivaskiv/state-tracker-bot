// src/controllers/handlers/callbackHandler.js — ВИПРАВЛЕНО: ВСЕ ПРАЦЮЄ

import antiSpam from '../../utils/antiSpam.js';
import createCallbackRouter from '../../utils/callbackRouter.js';
import keyboards from '../../utils/keyboards.js';
import { handleCallback as startCb } from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../flows/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS } from '../../config/constants.js';

// ✅ ФУНКЦІЯ ДЛЯ ВІДПРАВКИ З ЗБЕРЕЖЕННЯМ МЕНЮ
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
    console.error('[callbackHandler] ❌ Помилка sendMessage:', error.message);
    await ctx.reply(text, keyboards.mainMenuKeyboard());
  }
};

const router = createCallbackRouter({ autoAnswer: true });

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ ГОЛОВНЕ МЕНЮ
// ═══════════════════════════════════════════════════════════════════════════
router.register(['main_menu', 'open_main'], async (ctx) => {
  console.log('[callbackHandler] 🏠 main_menu');
  await ctx.reply('🏠 ГОЛОВНЕ МЕНЮ\n\nОбери дію 👇', keyboards.mainMenuKeyboard());
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ ІНФОРМАЦІЙНЕ МЕНЮ
// ═══════════════════════════════════════════════════════════════════════════
router.register('info_menu', async (ctx) => {
  console.log('[callbackHandler] ℹ️ info_menu');
  await sendMessage(ctx, 'ℹ️ ІНФОРМАЦІЯ ПРО БОТА\n\nОбери розділ:', keyboards.infoMenuInline());
  return true;
});

// ✅ НОВИЙ: Можливості бота
router.register('show_capabilities', async (ctx) => {
  console.log('[callbackHandler] 📋 show_capabilities');
  
  const message = 
    `🤖 МОЖЛИВОСТІ AI-НАСТАВНИКА\n\n` +
    `🎯 AI Наставник 24/7\n` +
    `• Персональні поради та підтримка\n` +
    `• Мікро-дії для досягнення цілей\n` +
    `• Аналіз блоків та страхів\n\n` +
    `🎯 Колесо балансу\n` +
    `• Оцінка 8 сфер життя\n` +
    `• AI-аналіз результатів\n` +
    `• Персональні рекомендації\n\n` +
    `📊 Аналітика та звіти\n` +
    `• Щотижневі звіти\n` +
    `• Щомісячні звіти\n` +
    `• Відстеження прогресу\n\n` +
    `🌞 Щоденні питання\n` +
    `• Ранкові питання о 08:00\n` +
    `• Вечірні питання о 21:30\n` +
    `• Автоматичний аналіз\n\n` +
    `💎 Мотивація\n` +
    `• Щоденні афірмації\n` +
    `• Підтримка у складні моменти`;
  
  await sendMessage(ctx, message, keyboards.infoMenuInline());
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 3️⃣ ПІДПИСКА
// ═══════════════════════════════════════════════════════════════════════════
router.register('subscription_info', async (ctx) => {
  console.log('[callbackHandler] 💰 subscription_info');
  await subscriptionController.handleSubscriptionInfo(ctx);
  return true;
});

// ✅ НОВИЙ: Статус підписки
router.register('subscription_status', async (ctx) => {
  console.log('[callbackHandler] 📋 subscription_status');
  await subscriptionController.handleSubscriptionInfo(ctx);
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 4️⃣ КОНТАКТИ
// ═══════════════════════════════════════════════════════════════════════════
router.register('contact', async (ctx) => {
  console.log('[callbackHandler] 📞 contact');
  await sendMessage(ctx, '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:', keyboards.contactMenuInline());
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 5️⃣ ЗВІТИ
// ═══════════════════════════════════════════════════════════════════════════
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

// ✅ ВИПРАВЛЕНО: Мій прогрес
router.register('my_progress', async (ctx) => {
  console.log('[callbackHandler] 📈 my_progress');
  try {
    await mainFlowController.handleCallback(ctx, 'my_progress');
  } catch (error) {
    console.error('[callbackHandler] ❌ my_progress:', error);
    await sendMessage(ctx, '❌ Помилка завантаження прогресу.', keyboards.mainMenuInline());
  }
  return true;
});

router.register('wheel_stats', async (ctx) => {
  console.log('[callbackHandler] 🎯 wheel_stats');
  try {
    await wheelController.handleCallback(ctx, 'wheel_stats');
  } catch (error) {
    console.error('[callbackHandler] ❌ wheel_stats:', error);
    await sendMessage(ctx, '❌ Помилка статистики.', keyboards.mainMenuInline());
  }
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 6️⃣ ДОПОМОГА / АФІРМАЦІЇ / ІНСТРУКЦІЇ
// ═══════════════════════════════════════════════════════════════════════════
router.register('instructions', async (ctx) => {
  console.log('[callbackHandler] 📝 instructions');
  await sendMessage(ctx, MENU_TEXTS.INSTRUCTIONS, keyboards.contactMenuInline());
  return true;
});

router.register('contact_support', async (ctx) => {
  console.log('[callbackHandler] 📞 contact_support');
  await sendMessage(ctx, MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
  return true;
});

router.register('show_affirmation', async (ctx) => {
  console.log('[callbackHandler] 💎 show_affirmation');
  const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
  await sendMessage(ctx, `✨ ${affirmation}`, keyboards.contactMenuInline());
  return true;
});

router.register('help', async (ctx) => {
  console.log('[callbackHandler] ❓ help');
  await sendMessage(ctx, MENU_TEXTS.HELP, keyboards.contactMenuInline());
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 7️⃣ ОНБОРДИНГ
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
// 8️⃣ ЩОДЕННІ СЕСІЇ
// ═══════════════════════════════════════════════════════════════════════════
// РАНКОВА СЕСІЯ
router.register('start_morning', async (ctx) => {
  console.log('[callbackHandler] 📅 start_morning');
  await dailyController.startMorningSession(ctx);
  return true;
});

// ВЕЧІРНЯ СЕСІЯ
router.register('start_evening', async (ctx) => {
  console.log('[callbackHandler] 📅 start_evening');
  await dailyController.startEveningSession(ctx);
  return true;
});

// Обробка callback з проміжними кроками сесій (наприклад, відповіді користувача)
router.register(
  (data) => data.includes('morning') || data.includes('evening'),
  async (ctx, data) => {
    console.log('[callbackHandler] 📅 daily action');
    await dailyController.handleCallback(ctx, data);
    return true;
  }
);

// Пропуск ранкової сесії і одразу вечірня
router.register('skip_morning_do_evening', async (ctx) => {
  await ctx.answerCbQuery('Ранкові пропущено');
  await dailyController.startEveningSession(ctx);
  return true;
});

// Примусовий старт вечірньої
router.register('force_evening', async (ctx) => {
  await ctx.answerCbQuery('Починаємо вечірні');
  await dailyController.startEveningSession(ctx);
  return true;
});// ═══════════════════════════════════════════════════════════════════════════
// 9️⃣ ПІДПИСКИ
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
// 🔟 КОЛЕСО БАЛАНСУ
// ═══════════════════════════════════════════════════════════════════════════
router.register({ prefix: 'wheel_' }, async (ctx, data) => {
  console.log('[callbackHandler] 🎯 wheel_*');
  await wheelController.handleCallback(ctx, data);
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣1️⃣ AI НАСТАВНИК
// ═══════════════════════════════════════════════════════════════════════════
router.register({ prefix: 'ai_' }, async (ctx) => {
  console.log('[callbackHandler] 🤖 ai_*');
  await aiMentorController.handleAIMentorCallback(ctx);
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣2️⃣ ІНШІ DAILY ACTIONS
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
// 1️⃣4️⃣ TIMEZONE PAGINATION
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣5️⃣ DISMISS/CANCEL
// ═══════════════════════════════════════════════════════════════════════════
router.register(['dismiss_reminder', 'dismiss_offer'], async (ctx) => {
  console.log('[callbackHandler] ⏭ dismiss');
  await ctx.reply('✅ Зрозуміло!', keyboards.mainMenuKeyboard());
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// ✅ ДОДАТИ в src/controllers/handlers/callbackHandler.js
// ═══════════════════════════════════════════════════════════════════════════

router.register('skip_morning_do_evening', async (ctx) => {
  await ctx.answerCbQuery('Ранкові пропущено');
  const dailyController = await import('../flows/dailyController.js');
  await dailyController.default.startEveningSession(ctx);
  return true;
});

router.register('force_evening', async (ctx) => {
  await ctx.answerCbQuery('Починаємо вечірні');
  const dailyController = await import('../flows/dailyController.js');
  await dailyController.default.startEveningSession(ctx);
  return true;
});

router.register('exit_all', async (ctx) => {
  const tgId = ctx.from.id;
  await userService.updateUserFields(tgId, { Answer_Step: 'completed' });
  await ctx.reply('🚪 Сесії завершено.', keyboards.mainMenuKeyboard());
  await ctx.answerCbQuery();
  return true;
});
// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣6️⃣ DEFAULT HANDLER
// ═══════════════════════════════════════════════════════════════════════════
const defaultHandler = async (ctx, data) => {
  console.log(`[callbackHandler] ❓ Невідомий callback: ${data}`);
  await ctx.reply('❓ Команда не розпізнана. Спробуй ще раз 👇', keyboards.mainMenuKeyboard());
  return true;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 ГОЛОВНИЙ ОБРОБНИК
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const handle = async (ctx) => {
  const userId = ctx.from?.id;
  const data = ctx.callbackQuery?.data || '';
  
  console.log(`[callbackHandler] ➡️ callback "${data}" від ${userId}`);

  if (antiSpam.isSpam(userId, data)) {
    try {
      await ctx.answerCbQuery('⏳ Зачекай трохи');
    } catch {}
    return true;
  }

  try {
    if (await startCb(ctx)) {
      return true;
    }

    const handled = await router.handle(ctx);
    if (handled) {
      return true;
    }

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