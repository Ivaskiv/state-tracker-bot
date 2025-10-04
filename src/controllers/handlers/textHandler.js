// src/controllers/handlers/textHandler.js - ОСТАТОЧНА ВЕРСІЯ

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { CURRENT_ACTIVITY, GENERAL_AFFIRMATIONS } from '../../config/constants.js';
import { aiMentorSession } from '../../utils/session.js';

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const rawText = ctx.message?.text || '';
  const text = rawText.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!text) return false;

  console.log(`[textHandler] 🔍 "${text.substring(0, 30)}..." від ${tgId}`);

  try {
    const user = await userService.getUserByTgId(tgId, { skipCache: true }); // ✅ БЕЗ КЕШУ!

    if (!user || !user.UserRegistered) {
      await ctx.reply('Спочатку зареєструйся /start', keyboards.mainMenuKeyboard());
      return true;
    }

    const step = user.Current_Activity;
    console.log(`[textHandler] 📍 Step: ${step}`);

    // ═══════════════════════════════════════════════════════════════════════
    // 1️⃣ АКТИВНІ СЕСІЇ - ОБРОБКА ВІДПОВІДЕЙ (ПРІОРИТЕТ #1)
    // ═══════════════════════════════════════════════════════════════════════
    
    // РАНКОВІ ПИТАННЯ
    if (step?.startsWith('Q_m_')) {
      console.log(`[textHandler] 🌞 Ранкова сесія: ${step}`);
      const dailyController = (await import('../flows/dailyController.js')).default;
      await dailyController.handleText(ctx, rawText, step);
      return true;
    }

    // ВЕЧІРНІ ПИТАННЯ
    if (step?.startsWith('Q_e_')) {
      console.log(`[textHandler] 🌙 Вечірня сесія: ${step}`);
      const dailyController = (await import('../flows/dailyController.js')).default;
      await dailyController.handleText(ctx, rawText, step);
      return true;
    }

    // КОЛЕСО БАЛАНСУ
    if (step === CURRENT_ACTIVITY.WHEEL) {
      console.log(`[textHandler] 🎯 Колесо активне`);
      const wheelController = (await import('../flows/wheelController.js')).default;
      await wheelController.handleText(ctx, rawText);
      return true;
    }

    // AI НАСТАВНИК
    if (aiMentorSession.isActive(tgId)) {
      console.log(`[textHandler] 🤖 AI активна`);
      const aiMentorController = (await import('../flows/aiMentorController.js')).default;
      await aiMentorController.handleAIQuestion(ctx, rawText);
      return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2️⃣ ОБРОБКА КОМАНД МЕНЮ
    // ═══════════════════════════════════════════════════════════════════════
    
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
        // Не розпізнали - ігноруємо
        return false;
    }

    return true;

  } catch (error) {
    console.error('[textHandler] ❌ GLOBAL:', error);
    console.error('[textHandler] Stack:', error.stack); // ✅ ПОВНИЙ STACK TRACE
    await ctx.reply('❌ Помилка обробки.', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default { handle };