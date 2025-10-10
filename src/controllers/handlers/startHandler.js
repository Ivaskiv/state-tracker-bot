// src/controllers/handlers/startHandler.js

import userService from '../../services/userService.js';
import { MESSAGES, ANSWER_STEPS } from '../../config/constants.js';
import keyboards from '../../utils/keyboards.js';

export const startHandler = async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  try {
    console.log(`[startHandler] 🚀 /start від ${tgId}`);
    
    let user = await userService.ensureUser(tgId, name);
    
    // Якщо користувач не зареєстрований — запускаємо онбординг
    if (!user.UserRegistered) {
      console.log(`[startHandler] 🆕 Новий користувач ${tgId}, запуск онбордингу`);
      console.log(`[startHandler] 📍 Поточний Answer_Step: ${user.Answer_Step}`);
      
      // Якщо крок вже встановлений при створенні (OB_NAME), просто показуємо форму
      if (!user.Answer_Step || user.Answer_Step === ANSWER_STEPS.IDLE) {
        await userService.updateUserStep(tgId, ANSWER_STEPS.OB_NAME);
      }
      
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(name),
        keyboards.nameChoiceInline()
      );
      return;
    }

    // Користувач зареєстрований — перевіряємо підписку
    const hasAccess = userService.hasActiveAccess(user);
    
    if (hasAccess) {
      console.log(`[startHandler] ✅ Активний користувач ${tgId}`);
      await ctx.reply(
        MESSAGES.WELCOME_BACK_ACTIVE(user['User Name'], user.End_Date || '—'),
        keyboards.mainMenuKeyboard()
      );
    } else {
      console.log(`[startHandler] ⚠️ Неактивна підписка ${tgId}`);
      await ctx.reply(
        MESSAGES.WELCOME_BACK_INACTIVE(user['User Name']),
        keyboards.subscriptionMenuInline()
      );
    }
  } catch (error) {
    console.error('[startHandler] ❌ Помилка:', error);
    await ctx.reply(
      '❌ Виникла помилка при запуску бота.\n\nСпробуй ще раз через кілька секунд або напиши /start'
    );
  }
};

export default { startHandler };