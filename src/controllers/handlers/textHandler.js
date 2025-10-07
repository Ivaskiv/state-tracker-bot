import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { CURRENT_ACTIVITY, GENERAL_AFFIRMATIONS } from '../../config/constants.js';
import { aiMentorSession } from '../../utils/session.js';

// Функції для прогресу/звіту
const getProgressText = (user) => {
  return `📈 Ваш прогрес:\n- Завдань виконано: ${user.CompletedTasks || 0}\n- Поточний рівень: ${user.Level || 1}`;
};

const getReportsText = (user) => {
  return `📊 Звіти:\n- Тиждень: +${user.WeekPoints || 0} балів\n- Місяць: +${user.MonthPoints || 0} балів`;
};

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const rawText = ctx.message?.text || '';
  const text = rawText.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!text) return false;

  console.log(`[textHandler] 🔍 "${text.substring(0, 30)}..." від ${tgId}`);

  try {
    const user = await userService.getUserByTgId(tgId, { skipCache: true });
    if (!user || !user.UserRegistered) {
      await ctx.reply('Спочатку зареєструйся /start', keyboards.mainMenuKeyboard());
      return true;
    }

    const step = user.Answer_Step;
    console.log(`[textHandler] 📍 Step: ${step}`);

    // АКТИВНІ СЕСІЇ
    if (step?.startsWith('Q_m_') || step?.startsWith('Q_e_')) {
      const dailyController = (await import('../flows/dailyController.js')).default;
      await dailyController.handleText(ctx, rawText, step);
      return true;
    }

    if (step === CURRENT_ACTIVITY.WHEEL) {
      const wheelController = (await import('../flows/wheelController.js')).default;
      await wheelController.handleText(ctx, rawText);
      return true;
    }

    if (aiMentorSession.isActive(tgId)) {
      const aiMentorController = (await import('../flows/aiMentorController.js')).default;
      await aiMentorController.handleAIQuestion(ctx, rawText);
      return true;
    }

    const hasAccess = userService.hasActiveAccess(user);
    const showBlock = async (feature) => {
      await ctx.reply(`🔒 "${feature}" - преміум!`, keyboards.subscriptionPlansKeyboard());
    };

    switch (true) {
      case text.includes('ai наставник'):
        if (!hasAccess) return await showBlock('AI Наставник');
        const aiMentorController = (await import('../flows/aiMentorController.js')).default;
        await aiMentorController.handleAIMentorRequest(ctx);
        break;

      case text.includes('колесо балансу'):
        if (!hasAccess) return await showBlock('Колесо балансу');
        const wheelController = (await import('../flows/wheelController.js')).default;
        await wheelController.handleCallback(ctx, 'wheel_start');
        break;

      // Нова кнопка "Мій прогрес + Звіти"
      case (text.includes('мій прогрес') && text.includes('звіти')) || text === '📊 мій прогрес та звіти':
        if (!hasAccess) return await showBlock('Звіти та Прогрес');
        await ctx.reply(`${getProgressText(user)}\n\n${getReportsText(user)}`, keyboards.mainMenuKeyboard());
        break;

      case text.includes('звіти'):
        if (!hasAccess) return await showBlock('Звіти');
        await ctx.reply('📊 ЗВІТИ', keyboards.reportsMenuInline());
        break;

      case text.includes('інформація про бота'):
        await ctx.reply('ℹ️ ІНФОРМАЦІЯ', keyboards.infoMenuInline());
        break;

      case text.includes('підписка'):
        await ctx.reply('💰 ПІДПИСКА', keyboards.subscriptionMenuInline());
        break;

      case text.includes('зв\'язок'):
        await ctx.reply('📞 ЗВ\'ЯЗОК', keyboards.contactMenuInline());
        break;

      case text.includes('афірмація'):
        const aff = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
        await ctx.reply(`✨ ${aff}`, keyboards.mainMenuKeyboard());
        break;

      default:
        return false;
    }

    return true;

  } catch (error) {
    console.error('[textHandler] ❌ GLOBAL:', error);
    await ctx.reply('❌ Помилка обробки.', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default { handle, getProgressText, getReportsText };
