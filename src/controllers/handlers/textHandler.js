// src/controllers/handlers/textHandler.js - РОУТИНГ ТЕКСТУ ЧЕРЕЗ ЦЕНТРАЛЬНІ КОНСТАНТИ/МЕНЮ

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

    // Якщо активні ранкові/вечірні/колесо — делегуємо спеціальним потокам
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
    await menuHandler.handleCommand(ctx, user, text, hasAccess);
    return true;

  } catch (error) {
    console.error('[textHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default { handle };
