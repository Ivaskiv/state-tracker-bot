import { Telegraf, session } from 'telegraf';
import keyboards from './src/utils/keyboards.js';
import reg from './src/controllers/flows/registrationController.js';
import userService from './src/auth/services/userService.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use(session({ defaultSession: () => ({}) }));

// /start
bot.start(async (ctx) => {
  const tgId = ctx.from.id;
  const telegramName = ctx.from.first_name || 'Користувач';
  console.log(`🚀 [/start] from=${tgId} (${telegramName})`);

  // 1) створюємо рядок, якщо нема
  const row = await userService.ensureUserRow(tgId, { name: telegramName });

  // 2) читаємо актуального юзера
  const user = await userService.getUserByTelegramId(tgId);

  // 3) якщо зареєстрований — меню / апселл
  if (user?.UserRegistered) {
    const active = userService.hasActiveAccess(user);
    if (active) {
      await ctx.reply(
        `👋 З поверненням, ${user['User Name'] || telegramName}!\n✅ Підписка активна.\nПродовжимо?`,
        keyboards.mainMenuKeyboard()
      );
    } else {
      await ctx.reply(
        `👋 З поверненням, ${user['User Name'] || telegramName}!\n` +
        `💡 Активуй підписку для повного доступу:`,
        keyboards.subscriptionPlansKeyboard()
      );
    }
    return;
  }

  // 4) інакше — онбординг
  await reg.start(ctx);
});
// TEXT
bot.on('text', async (ctx) => {
  // якщо йде онбординг — хай controller зʼїсть повідомлення
  const consumed = await reg.onText(ctx);
  if (consumed) return;

  // інше: просто меню-підказка
  await ctx.reply('Обери дію з меню 👇', keyboards.mainMenuKeyboard());
});

// CALLBACK
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  await ctx.answerCbQuery().catch(() => {});
  const consumed = await reg.onCallback(ctx, data);
  if (consumed) return;

  await ctx.reply('Команда оброблена.');
});

// запуск
(async () => {
  await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(()=>{});
  await bot.launch();
  console.log('✅ Бот запущено');
})();
