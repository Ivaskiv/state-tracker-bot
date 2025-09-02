// src/modules/menu.js
import keyboards from '../utils/keyboards.js';
import analyticsController from '../controllers/analyticsController.js';
import affirmationService from '../services/affirmationService.js';
import responseService from '../services/responseService.js';
import userService from '../services/userService.js';

// Matcher-и для команд меню (гнучко приймаємо старі назви)
export const MENU_MATCHERS = {
  WEEKLY: (t) => t === '📈 Щотижневий звіт',
  MONTHLY: (t) => t === '📈 Щомісячний звіт',
  AFFIRM: (t) => t === '💎 Афірмація',
  PROGRESS: (t) => ['📋 Мій прогрес', '📊 Мій прогрес'].includes(t),
  SUBSCRIPTION: (t) => t === '💰 Підписка',
  HELP: (t) => t === '❓ Допомога',
  CONTACT: (t) => t === '📞 Зв\'язок з нами',
  INSTRUCTIONS: (t) => t === '📝 Інструкції',
  QUICK_OK: (t) => ['+', 'ок', 'ok', 'добре', 'так'].includes(t.toLowerCase())
};

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
    return ctx.reply(`🌀 Афірмація:\n\n${aff}`, keyboards.mainMenuKeyboard());
  }
  if (MENU_MATCHERS.PROGRESS(text)) {
    return showUserProgress(ctx, user);
  }
  if (MENU_MATCHERS.SUBSCRIPTION(text)) {
    return showSubscriptionInfo(ctx, user);
  }
  if (MENU_MATCHERS.HELP(text)) {
    const helpText = `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`;
    return ctx.reply(helpText, keyboards.mainMenuKeyboard());
  }
  if (MENU_MATCHERS.CONTACT(text)) {
    const contactText = `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`;
    return ctx.reply(contactText, keyboards.supportKeyboard());
  }
  if (MENU_MATCHERS.INSTRUCTIONS(text)) {
    const instructionsText = `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📈 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📋 Мій прогрес" — статистика\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• 08:00 — ранкові питання (6 запитань)\n• 20:30 — вечірні питання (5 запитань)\n\n💡 **ПОРАДИ:**\n• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв'язок з нами" при проблемах`;
    return ctx.reply(instructionsText, keyboards.mainMenuKeyboard());
  }
  if (MENU_MATCHERS.QUICK_OK(text)) {
    const aff = await affirmationService.getAffirmationAndMarkUsed();
    return ctx.reply(`💝 Швидка підтримка!\n\n${aff}`, keyboards.mainMenuKeyboard());
  }

  return ctx.reply('Оберіть пункт з меню:', keyboards.mainMenuKeyboard());
}

// ——— приватні утиліти меню ———
async function showSubscriptionInfo(ctx, user) {
  if (!user) {
    await typing(ctx);
    return ctx.reply('Спочатку зареєструйтесь /start');
  }
  const active = user['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user['Active Subscription Plan'] || '—';
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';
  const subscriptionText =
    `📦 ПІДПИСКА:\n\n` +
    (active.includes('✅')
      ? `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`
      : '❌ Неактивна') +
    `\n\n📝 Реєстраційні дані: ✅ Заповнені`;
  await typing(ctx);
  return ctx.reply(subscriptionText, keyboards.mainMenuKeyboard());
}

async function showUserProgress(ctx, user) {
  if (!user) {
    await typing(ctx);
    return ctx.reply('Спочатку зареєструйтесь /start');
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

    const progressText =
      `📋 ВАШ ПРОГРЕС (за 30 днів):\n\n` +
      `📝 Всього днів: ${totalDays}\n` +
      `🌅 Ранкові: ${morningCompleted}\n` +
      `🌙 Вечірні: ${eveningCompleted}\n\n` +
      `💡 Для детального аналізу використовуй кнопки "📈 Щотижневий звіт" і "📈 Щомісячний звіт"`;
    await typing(ctx);
    return ctx.reply(progressText, keyboards.mainMenuKeyboard());
  } catch (e) {
    console.error('[menu.showUserProgress] Помилка:', e);
    await typing(ctx);
    return ctx.reply('📊 Прогрес тимчасово недоступний', keyboards.mainMenuKeyboard());
  }
}

async function typing(ctx) {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise(res => setTimeout(res, 800));
  } catch (_) {}
}
