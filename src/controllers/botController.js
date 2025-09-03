// src/controllers/botController.js
import userService from '../services/userService.js';
import keyboards from '../utils/keyboards.js';
import { handleStart, handleRegistrationStep } from '../modules/auth.js';
import { handleMenuCommand } from '../modules/menu.js';
import { handleOngoingQuestions } from '../modules/answers.js';
import { refreshMenuIfDev } from '../utils/refreshMenu.js';

export default function botController(bot) {
bot.catch((err, ctx) => {
  console.error('[botController] Помилка:', err);
  bot.telegram.sendChatAction(ctx.from?.id, 'typing').catch(()=>{});
  ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard()).catch(()=>{});
});

  bot.start(async (ctx) => {
    await refreshMenuIfDev(ctx);
    return handleStart(ctx);
  });

  // 4) Перевіряємо чи є у користувача доступ до меню
const user = userService.getUserByTelegramId(ctx.from.id).then(async (user) => {
  if (user && !user['Active_Subscription_Status']?.includes('✅ Активна')) {
    if (!['💰 Підписка', '❓ Допомога', '📞 Зв\'язок з нами'].includes(text)) {
      return ctx.reply('❌ Для цієї функції потрібна активна підписка.\n\nОформи підписку в меню "💰 Підписка"', keyboards.mainMenuKeyboard());
    }
  }
  // 5) Інакше — це команда меню
  return handleMenuCommand(ctx);
});
bot.on('text', async (ctx) => {
  await refreshMenuIfDev(ctx);

  // 1) Якщо користувач у процесі реєстрації — обробляємо крок реєстрації й виходимо
  const handledAuth = await handleRegistrationStep(ctx);
  if (handledAuth) return;

  // 2) Якщо є активні питання (ранок/вечір) — обробляємо і виходимо
  const handledQ = await handleOngoingQuestions(ctx);
  if (handledQ) return;

  // 3) Перевіряємо доступ до меню
  const user = await userService.getUserByTelegramId(ctx.from.id);
  const text = ctx.message?.text || '';
  
  if (user && !user['Active_Subscription_Status']?.includes('✅ Активна')) {
    if (!['💰 Підписка', '❓ Допомога', '📞 Зв\'язок з нами'].includes(text)) {
      return ctx.reply('❌ Для цієї функції потрібна активна підписка.\n\nОформи підписку в меню "💰 Підписка"', keyboards.mainMenuKeyboard());
    }
  }

  // 4) Інакше — це команда меню
  return handleMenuCommand(ctx);
});
  bot.on('callback_query', async (ctx) => {
    await refreshMenuIfDev(ctx);
    // Якщо є інлайн-кнопки у майбутньому — тут обробляй їх data
    await ctx.answerCbQuery();
  });
}
