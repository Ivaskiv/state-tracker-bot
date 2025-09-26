// src/controllers/handlers/startHandler.js
// /start: без проміс-гонок, без «готую меню…», з різними меседжами для нових/існуючих
// ВАЖЛИВО: без статичного імпорту неіснуючого модуля

const safeFallbackStart = async (ctx) => {
  // Мінімальний фолбек, якщо БД лежить
  try {
    await ctx.reply(
      '👋 Привіт! Я твій AI-мотиватор і коуч.\n' +
      'Почнімо з короткого знайомства — як до тебе звертатися?'
    );
  } catch {}
};

const startHandler = {
  async handle(ctx, userService) {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    const t0 = Date.now();

    console.log(`🚀 [/start] від ${tgId} (${name})`);

    // 1) Читаємо користувача з БД
    let user = null;
    let dbHealthy = true;
    try {
      user = await userService.getUserByTelegramId(tgId);
      console.log(`[startHandler] ℹ️ user:`, user ? {
        name: user['User Name'],
        registered: user.UserRegistered,
        plan: user['Active Subscription Plan'],
        status: user['Active_Subscription_Status']
      } : 'null');
    } catch (e) {
      dbHealthy = false;
      console.warn(`[startHandler] ⚠️ DB error getUserByTelegramId: ${e?.message || e}`);
    }

    if (!dbHealthy) {
      console.log('[startHandler] ⛑️ Fallback: DB недоступна');
      await safeFallbackStart(ctx);
      return;
    }

    const mainFlowController = (await import('../flows/mainFlowController.js')).default;

    // 2) Новий або незавершений онбординг
    if (!user || !user.UserRegistered || !user['User Name'] || !user.Email) {
      console.log('[startHandler] 🆕 Новий/незавершений користувач → реєстрація');
      const registrationController = (await import('../flows/registrationController.js')).default;

      const msg =
        `👋 Привіт, ${name}!\n\n` +
        `Я твій AI-мотиватор і коуч: короткі щоденні питання → фокус → прогрес.\n\n` +
        `Давай познайомимось — як до тебе звертатись? Введи ім’я (2–30 символів).`;
      try { await ctx.reply(msg); } catch {}

      await registrationController.startRegistration(ctx);
      console.log(`[startHandler] ▶️ Registration start in ${Date.now() - t0}ms`);
      return;
    }

    // 3) Є користувач — перевіряємо доступ
    const hasActive = userService.hasActiveAccess(user);
    console.log(`[startHandler] 💰 hasActive=${hasActive}`);

    if (!hasActive) {
      const msg =
        `👋 З поверненням, ${user['User Name'] || name}!\n\n` +
        `Щоб продовжити щоденні сесії та аналітику, активуй підписку.`;
      try { await ctx.reply(msg); } catch {}

      await mainFlowController.showSubscriptionRequired(ctx, user);
      console.log(`[startHandler] 💳 Upsell in ${Date.now() - t0}ms`);
      return;
    }

    // 4) Перше колесо?
    let hasFirstWheel = false;
    try {
      hasFirstWheel = await mainFlowController.checkFirstWheel(tgId);
    } catch (e) {
      console.warn(`[startHandler] ⚠️ checkFirstWheel: ${e?.message || e}`);
    }
    console.log(`[startHandler] 🎯 hasFirstWheel=${hasFirstWheel}`);

    if (!hasFirstWheel) {
      const userName = user?.['User Name'] || name;
      const msg =
        `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
        `Привіт, ${userName}! 👋\n\n` +
        `Ми радимо почати саме з колеса балансу — так AI зможе давати тобі **персоналізовані** підказки і стратегії.\n\n` +
        `📊 8 сфер життя (5–10 хв)\n` +
        `🧭 Отримаєш свої фокуси на 30 днів\n\n` +
        `Готова почати?`;

      await ctx.reply(msg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Почати колесо', callback_data: 'wheel_start' }],
            [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }],
            [{ text: '⏭ Пізніше', callback_data: 'main_menu' }]
          ]
        }
      });
      console.log(`[startHandler] 🧭 Wheel suggested in ${Date.now() - t0}ms`);
      return;
    }

    // 5) Все ок → тепле «продовжимо?» + меню
    const contMsg =
      `👋 Раді бачити знову, ${user['User Name'] || name}!\n` +
      `Продовжимо з того місця, де зупинились?`;
    try { await ctx.reply(contMsg); } catch {}

    await mainFlowController.showMainMenu(ctx, user);
    console.log(`[startHandler] ✅ Main menu in ${Date.now() - t0}ms`);
  }
};

export default startHandler;
