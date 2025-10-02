// src/controllers/handlers/textHandler.js - ОПТИМІЗОВАНИЙ

import { MENU_TEXTS } from '../../config/constants.js';
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

    // ===== НОВІ ОБ'ЄДНАНІ КНОПКИ =====
    
    // 📊 Звіти та прогрес
    if (text === '📊 Звіти та прогрес' || text === '📊 Звіти') {
      if (!hasAccess) {
        await menuHandler.showFeatureBlocked(ctx, 'Звіти та прогрес');
        return true;
      }
      await ctx.reply(
        '📊 ЗВІТИ ТА ПРОГРЕС\n\nОбери розділ:',
        keyboards.reportsMenuInline()
      );
      return true;
    }

    // ❓ Допомога та підтримка
    if (text === '❓ Допомога та підтримка' || text === '❓ Допомога') {
      await ctx.reply(
        '❓ ДОПОМОГА\n\nОбери розділ:',
        keyboards.helpMenuInline()
      );
      return true;
    }

    // ===== ДЕЛЕГУЄМО РЕШТУ В menuHandler =====
    await menuHandler.handleCommand(ctx, user, text, hasAccess);
    return true;

  } catch (error) {
    console.error('[textHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default { handle };