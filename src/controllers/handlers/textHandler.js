// src/controllers/handlers/textHandler.js - ОПТИМІЗОВАНИЙ

import userService from '../../services/userService.js';
import menuHandler from './menuHandler.js';
import keyboards from '../../utils/keyboards.js';

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  if (!text) return false;

  console.log(`[textHandler] "${text}" від ${tgId}`);

  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user || !user.UserRegistered) {
      await ctx.reply('Спочатку зареєструйся /start');
      return true;
    }

    const step = user.Answer_Step;

    // ===== АКТИВНІ СЕСІЇ (пріоритет) =====
    if (step === 'WheelBalance') {
      const wheelController = (await import('../flows/wheelController.js')).default;
      await wheelController.handleText?.(ctx, text);
      return true;
    }

    if (step?.startsWith('Q_m_') || step?.startsWith('Q_e_')) {
      const dailyController = (await import('../flows/dailyController.js')).default;
      await dailyController.handleText?.(ctx, text, step);
      return true;
    }

    const hasAccess = userService.hasActiveAccess(user);

    // ===== НОВІ КНОПКИ ГОЛОВНОГО МЕНЮ =====
    
    switch (text) {
      // 🤖 AI Наставник
      case '🤖 AI Наставник':
        if (!hasAccess) {
          await menuHandler.showFeatureBlocked(ctx, 'AI Наставник');
          return true;
        }
        const aiMentorController = (await import('../flows/aiMentorController.js')).default;
        await aiMentorController.handleAIMentorRequest(ctx);
        return true;

      // 🎯 Колесо балансу
      case '🎯 Колесо балансу':
        if (!hasAccess) {
          await menuHandler.showFeatureBlocked(ctx, 'Колесо балансу');
          return true;
        }
        const wheelController = (await import('../flows/wheelController.js')).default;
        await wheelController.handleRequest(ctx);
        return true;

      // 📊 Звіти
      case '📊 Звіти':
        if (!hasAccess) {
          await menuHandler.showFeatureBlocked(ctx, 'Звіти');
          return true;
        }
        await ctx.reply(
          '📊 ЗВІТИ\n\nОбери тип звіту:',
          keyboards.reportsMenuInline()
        );
        return true;

      // ℹ️ Інформація
      case 'ℹ️ Інформація':
        await ctx.reply(
          'ℹ️ ІНФОРМАЦІЯ\n\nОбери розділ:',
          keyboards.infoMenuInline()
        );
        return true;

      // ===== ЗАСТАРІЛІ КНОПКИ (зворотна сумісність) =====
      case '💰 Підписка':
        await ctx.reply(
          '💰 ПІДПИСКА\n\nОбери дію:',
          keyboards.subscriptionMenuInline()
        );
        return true;

      case '❓ Допомога':
        await ctx.reply(
          '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:',
          keyboards.contactMenuInline()
        );
        return true;

      case '💎 Афірмація':
        const GENERAL_AFFIRMATIONS = [
          'Моя енергія створює позитивні зміни',
          'Я заслуговую на все найкраще',
          'Моя рішучість творить можливості',
          'Щодня впевнено йду до мети',
          'Дія — мова проти страху'
        ];
        const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
        await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
        return true;

      case '📈 Щотижневий звіт':
      case '📈 Щомісячний звіт':
      case '📊 Мій прогрес':
        if (!hasAccess) {
          await menuHandler.showFeatureBlocked(ctx, 'Звіти');
          return true;
        }
        await menuHandler.handleCommand(ctx, user, text, hasAccess);
        return true;

      default:
        console.log(`[textHandler] ❓ Невідома команда: "${text}"`);
        await ctx.reply(
          '❓ Не розпізнав команду. Використовуй головне меню внизу 👇',
          keyboards.mainMenuKeyboard()
        );
        return true;
    }

  } catch (error) {
    console.error('[textHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default { handle };