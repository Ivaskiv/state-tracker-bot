// src/bot/router.js
// Головний роутер бота - підключення всіх модулів

import onboarding, { 
  handleCallback as onboardingCallback, 
  handleText as onboardingText 
} from '../features/onboarding/index.js';

import dashboard, { 
  handleCallback as dashboardCallback,
  handleText as dashboardText
} from '../features/dashboard/index.js';

// TODO: Додати інші модулі
// import dailySessions, { handleCallback as dailyCallback, handleText as dailyText } from '../features/dailySessions/index.js';
// import wheelBalance, { handleCallback as wheelCallback, handleText as wheelText } from '../features/wheelBalance/index.js';
// import aiMentor, { handleCallback as aiCallback, handleText as aiText } from '../features/aiMentor/index.js';
// import reports, { handleCallback as reportsCallback, handleText as reportsText } from '../features/reports/index.js';
// import subscription, { handleCallback as subscriptionCallback, handleText as subscriptionText } from '../features/subscription/index.js';

import keyboards from '../utils/keyboards.js';

/**
 * Ініціалізація роутера
 */
export const initRouter = (bot) => {
  console.log('🎮 [router] Ініціалізація...');

  // ===== МОДУЛІ =====
  
  // Онбординг (реєстрація)
  onboarding(bot);
  
  // Dashboard (головне меню)
  dashboard(bot);

  // TODO: Підключити інші модулі
  // dailySessions(bot);
  // wheelBalance(bot);
  // aiMentor(bot);
  // reports(bot);
  // subscription(bot);

  // ===== ГЛОБАЛЬНІ HANDLERS =====

  /**
   * Обробка callback_query
   * Порядок важливий - від специфічного до загального
   */
bot.on('callback_query', async (ctx, next) => {
  const data = ctx.callbackQuery?.data;
  console.log(`[router/callback] 🎯 Обробка: "${data}"`);
  
  try {
    // 1️⃣ Dashboard
    console.log(`[router/callback] 🏠 Перевірка dashboard...`);
    const handledDashboard = await dashboardCallback(ctx);
    console.log(`[router/callback] Dashboard handled: ${handledDashboard}`);
    if (handledDashboard) {
        try { await ctx.answerCbQuery(); } catch {}
        return;
      }

      // 2️⃣ Онбординг (реєстрація)
    console.log(`[router/callback] 🎓 Перевірка onboarding...`);
    const handledOnboarding = await onboardingCallback(ctx);
    console.log(`[router/callback] Onboarding handled: ${handledOnboarding}`);
    if (handledOnboarding) {        
      try { await ctx.answerCbQuery(); } catch {}
        return;
      }


      // TODO: Додати інші модулі
      // 3️⃣ Щоденні сесії
      // const handledDaily = await dailyCallback(ctx);
      // if (handledDaily) return;

      // 4️⃣ Колесо балансу
      // const handledWheel = await wheelCallback(ctx);
      // if (handledWheel) return;

      // 5️⃣ AI Наставник
      // const handledAI = await aiCallback(ctx);
      // if (handledAI) return;

      // 6️⃣ Звіти
      // const handledReports = await reportsCallback(ctx);
      // if (handledReports) return;

      // 7️⃣ Підписки
      // const handledSubscription = await subscriptionCallback(ctx);
      // if (handledSubscription) return;

      // 8️⃣ Нічого не оброблено
      console.log(`[router/callback] ❓ Невідома команда: ${ctx.callbackQuery?.data}`);
      try { await ctx.answerCbQuery('❓ Невідома команда'); } catch {}
      await ctx.reply(
        '❓ Невідома команда. Використай меню нижче.',
        keyboards.mainMenuKeyboard()
      );

    } catch (error) {
      console.error('[router/callback] ❌ Помилка:', error);
      try { await ctx.answerCbQuery('❌ Помилка'); } catch {}
      await ctx.reply(
        '❌ Виникла помилка. Спробуй ще раз.',
        keyboards.mainMenuKeyboard()
      ).catch(() => {});
    }
  });

  /**
   * Обробка text повідомлень
   * Порядок важливий - від специфічного до загального
   */
  bot.on('text', async (ctx, next) => {
    try {
      // 1️⃣ Dashboard (кнопки меню)
      const handledDashboard = await dashboardText(ctx);
      if (handledDashboard) return;

      // 2️⃣ Онбординг (введення імені, email, телефону)
      const handledOnboarding = await onboardingText(ctx);
      if (handledOnboarding) return;

      // TODO: Додати інші модулі
      // 3️⃣ Щоденні сесії (відповіді на питання)
      // const handledDaily = await dailyText(ctx);
      // if (handledDaily) return;

      // 4️⃣ AI Наставник (запитання до AI)
      // const handledAI = await aiText(ctx);
      // if (handledAI) return;

      // 5️⃣ Звіти (команди типу "звіт за тиждень")
      // const handledReports = await reportsText(ctx);
      // if (handledReports) return;

      // 6️⃣ Нічого не оброблено - показуємо меню
      await ctx.reply(
        '❓ Невідома команда. Використай меню нижче.',
        keyboards.mainMenuKeyboard()
      );

    } catch (error) {
      console.error('[router/text] ❌ Помилка:', error);
      await ctx.reply(
        '❌ Виникла помилка. Спробуй ще раз або натисни /start',
        keyboards.mainMenuKeyboard()
      ).catch(() => {});
    }
  });

  console.log('✅ [router] Готовий');
};

console.log('✅ [bot/router] Router завантажено');