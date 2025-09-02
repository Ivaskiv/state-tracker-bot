// src/controllers/botController.js
import userService from '../services/userService.js';
import keyboards from '../utils/keyboards.js';
import { handleStart, handleRegistrationStep } from '../modules/auth.js';
import { handleMenuCommand, MENU_MATCHERS } from '../modules/menu.js';
import { handleOngoingQuestions } from '../modules/answers.js';
import { refreshMenuIfDev } from '../utils/refreshMenu.js';

export default function botController(bot) {
  bot.catch((err, ctx) => {
    console.error('[botController] Помилка:', err);
    bot.telegram.sendChatAction(ctx.from?.id, 'typing').catch(()=>{});
    setTimeout(() => ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard()), 1000);
  });

  bot.start(async (ctx) => {
    await refreshMenuIfDev(ctx);
    return handleStart(ctx);
  });

  bot.on('text', async (ctx) => {
    await refreshMenuIfDev(ctx);

    // 1) Якщо користувач у процесі реєстрації — обробляємо крок реєстрації й виходимо
    const handledAuth = await handleRegistrationStep(ctx);
    if (handledAuth) return;

    // 2) Якщо є активні питання (ранок/вечір) — обробляємо і виходимо
    const handledQ = await handleOngoingQuestions(ctx);
    if (handledQ) return;

    // 3) Інакше — це команда меню
    return handleMenuCommand(ctx);
  });

  bot.on('callback_query', async (ctx) => {
    await refreshMenuIfDev(ctx);
    // Якщо є інлайн-кнопки у майбутньому — тут обробляй їх data
    await ctx.answerCbQuery();
  });
}
