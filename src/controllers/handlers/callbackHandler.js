import antiSpam from '../../utils/antiSpam.js';
import createCallbackRouter from '../../utils/callbackRouter.js';
import keyboards from '../../utils/keyboards.js';
import registrationHandler from './registrationHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../flows/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import userService from '../../services/userService.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS } from '../../config/constants.js';

// ----------------- HELPER -----------------
const sendMessage = async (ctx, text, keyboard = null) => {
  const replyMarkup = keyboard ? { reply_markup: keyboard } : {};
  try {
    if (ctx.callbackQuery) {
      try {
        await ctx.reply(text, replyMarkup);
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
  await ctx.reply('🏠 ГОЛОВНЕ МЕНЮ\n\nОбери дію 👇', keyboards.mainMenuKeyboard());
  return true;
});

// ----------------- INFO -----------------
router.register('info_menu', async (ctx) =>
  sendMessage(ctx, 'ℹ️ ІНФОРМАЦІЯ ПРО БОТА\n\nОбери розділ:', keyboards.infoMenuInline())
);

router.register('show_capabilities', async (ctx) => {
  const message =
    `🤖 МОЖЛИВОСТІ AI-НАСТАВНИКА\n\n` +
    `🎯 AI Наставник 24/7\n• Персональні поради\n• Мікро-дії\n\n` +
    `⚖️ Колесо балансу\n• Оцінка 8 сфер\n• AI-аналіз\n\n` +
    `📊 Звіти\n• Щотижневі / Щомісячні\n\n` +
    `🌞 Щоденні питання\n• Ранок 08:00\n• Вечір 21:30\n\n` +
    `💎 Афірмації та підтримка`;
  await sendMessage(ctx, message, keyboards.infoMenuInline());
});

// ----------------- SUBSCRIPTION -----------------
router.register(['subscription_info', 'subscription_status'], async (ctx) => {
  await subscriptionController.handleSubscriptionInfo(ctx);
  return true;
});

router.register(
  (data) => /^(subscription_|subscribe_|plan_|renew_|sync_subscription|activate_trial)/.test(data),
  async (ctx) => {
    await subscriptionController.handleCallback(ctx);
    return true;
  }
);

// ----------------- CONTACT -----------------
router.register(['contact', 'contact_support', 'help', 'instructions'], async (ctx, data) => {
  let text = '';
  switch (data) {
    case 'contact_support':
      text = MENU_TEXTS.CONTACT;
      break;
    case 'help':
      text = MENU_TEXTS.HELP;
      break;
    case 'instructions':
      text = MENU_TEXTS.INSTRUCTIONS;
      break;
    default:
      text = '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:';
  }
  await sendMessage(ctx, text, keyboards.contactMenuInline());
  return true;
});

router.register('show_affirmation', async (ctx) => {
  const affirmation =
    GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
  await sendMessage(ctx, `✨ ${affirmation}`, keyboards.mainMenuKeyboard());
});

// ----------------- REPORTS -----------------
router.register('reports_menu', async (ctx) =>
  sendMessage(ctx, '📊 ЗВІТИ\n\nОбери тип звіту:', keyboards.reportsMenuInline())
);

router.register(['get_weekly_report', 'get_monthly_report'], async (ctx, data) => {
  try {
    await mainFlowController.handleCallback(ctx, data);
  } catch {
    await sendMessage(ctx, '❌ Помилка. Спробуй пізніше.', keyboards.mainMenuInline());
  }
  return true;
});

// ----------------- DAILY SESSIONS -----------------
router.register(['start_morning', 'restart_morning'], async (ctx) => {
  try {
    await dailyController.startMorningSession(ctx);
  } catch (e) {
    console.error('[callbackHandler] ❌ morning session:', e);
    await ctx.reply('❌ Помилка запуску ранкової сесії');
  }
  return true;
});

router.register(['start_evening', 'restart_evening'], async (ctx) => {
  try {
    await dailyController.startEveningSession(ctx);
  } catch (e) {
    console.error('[callbackHandler] ❌ evening session:', e);
    await ctx.reply('❌ Помилка запуску вечірньої сесії');
  }
  return true;
});

router.register('skip_morning_do_evening', async (ctx) => {
  await ctx.answerCbQuery('Ранкові пропущено');
  await dailyController.startEveningSession(ctx);
});

// проміжні кроки сесій
router.register(
  (data) => data.includes('morning_') || data.includes('evening_'),
  async (ctx, data) => {
    await dailyController.handleCallback(ctx, data);
    return true;
  }
);

// ----------------- WHEEL -----------------
router.register({ prefix: 'wheel_' }, async (ctx, data) => {
  await wheelController.handleCallback(ctx, data);
  return true;
});

// ----------------- AI MENTOR -----------------
router.register({ prefix: 'ai_' }, async (ctx) => {
  await aiMentorController.handleAIMentorCallback(ctx);
  return true;
});
router.register('show_progress', async (ctx) => {
  const tgId = ctx.from.id;
  const user = await userService.getUserByTgId(tgId);
  
  if (!user) {
    await ctx.reply('Користувач не знайдений. /start');
    return true;
  }
  
  const hasAccess = userService.hasActiveAccess(user);
  
  if (!hasAccess) {
    await ctx.editMessageText(
      '🔒 Звіти та прогрес доступні тільки з підпискою!\n\n' +
      '💡 Активуй пробний період на 7 днів безкоштовно або обери платний план.',
      keyboards.subscriptionMenuInline()
    );
    return true;
  }
  
  const progressText = `📈 Ваш прогрес:\n- Завдань виконано: ${user.CompletedTasks || 0}\n- Поточний рівень: ${user.Level || 1}`;
  const reportsText = `📊 Звіти:\n- Тиждень: +${user.WeekPoints || 0} балів\n- Місяць: +${user.MonthPoints || 0} балів`;
  
  await ctx.editMessageText(
    `${progressText}\n\n${reportsText}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Щотижневий звіт', callback_data: 'get_weekly_report' }],
          [{ text: '📈 Щомісячний звіт', callback_data: 'get_monthly_report' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    }
  );
  return true;
});
// ----------------- ONBOARDING -----------------
router.register(
  (data) =>
    [
      'use_telegram_name',
      'enter_custom_name',
      'skip_email',
      'skip_phone',
      'activate_trial',
      'plan_free',
    ].includes(data),
  async (ctx)=> await registrationHandler.handleCallback(ctx)
);
// ----------------- RETRY / SKIP для сесій -----------------
router.register(
  (data) => data.startsWith('retry_') || data.startsWith('skip_'),
  async (ctx, data) => {
    await dailyController.handleCallback(ctx, data);
    return true;
  }
);

router.register('exit_session', async (ctx) => {
  const tgId = ctx.from.id;
  await userService.updateUserFields(tgId, { Answer_Step: 'completed' });
  await ctx.reply('🚪 Сесію завершено.', keyboards.mainMenuKeyboard());
  return true;
});
// ----------------- EXIT -----------------
router.register('exit_all', async (ctx) => {
  const tgId = ctx.from.id;
  await userService.updateUserFields(tgId, { Answer_Step: 'completed' });
  await ctx.reply('🚪 Сесії завершено.', keyboards.mainMenuKeyboard());
  return true;
});

// ----------------- DEFAULT -----------------
const defaultHandler = async (ctx, data) => {
  await ctx.reply('❓ Команда не розпізнана. Спробуй ще раз 👇', keyboards.mainMenuKeyboard());
  return true;
};

// ----------------- MAIN EXPORT -----------------
export const handle = async (ctx) => {
  const userId = ctx.from?.id;
  const data = ctx.callbackQuery?.data || '';

  console.log(`[callbackHandler] ➡️ "${data}" від ${userId}`);

  if (antiSpam.isSpam(userId, data)) {
    try {
      await ctx.answerCbQuery('⏳ Зачекай трохи');
    } catch {}
    return true;
  }

  try {
    const handled = await router.handle(ctx);
    if (handled) return true;
    return await defaultHandler(ctx, data);
  } catch (error) {
    console.error('[callbackHandler] ❌ GLOBAL ERROR:', error);
    try {
      await ctx.reply('❌ Помилка. Спробуй /start або обери дію 👇', keyboards.mainMenuKeyboard());
    } catch {}
    return true;
  }
};

export default { handle };
