// src/controllers/handlers/startHandler.js - ВИПРАВЛЕНО
const startHandler = {
  async handle(ctx, userService) {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    const t0 = Date.now();

    console.log(`🚀 [/start] від ${tgId} (${name})`);

    // 1) Чита

    // 2) ВИПРАВЛЕНА ЛОГІКА: перевіряємо чи користувач дійсно зареєстрований
    const isFullyRegistered = user && 
      user.UserRegistered === true && 
      user['User Name'] && 
      user.Email && 
      user.Status === 'Registered User';

    console.log(`[startHandler] 🔍 Статус реєстрації:`, {
      userExists: !!user,
      UserRegistered: user?.UserRegistered,
      hasName: !!user?.['User Name'],
      hasEmail: !!user?.Email,
      status: user?.Status,
      isFullyRegistered
    });

    // 3) Якщо не зареєстрований - онбординг
    if (!isFullyRegistered) {
      console.log('[startHandler] 🆕 Новий/незавершений користувач → реєстрація');
      
      const msg =
        `👋 Привіт, ${name}!\n\n` +
        `Я твій AI-мотиватор і коуч: короткі щоденні питання → фокус → прогрес.\n\n` +
        `Давай познайомимось — як до тебе звертатись? Введи ім'я (2–30 символів).`;
      
      await ctx.reply(msg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }],
            [{ text: 'ℹ️ Про бота', callback_data: 'about_bot' }]
          ]
        }
      });
      
      console.log(`[startHandler] ▶️ Registration start in ${Date.now() - t0}ms`);
      return;
    }

    // 4) Користувач зареєстрований - перевіряємо доступ
    const hasActive = userService.hasActiveAccess(user);
    console.log(`[startHandler] 💰 hasActive=${hasActive}`);

    if (!hasActive) {
      const msg =
        `👋 З поверненням, ${user['User Name'] || name}!\n\n` +
        `Щоб продовжити щоденні сесії та аналітику, активуй підписку.`;
      
      await ctx.reply(msg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
            [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
            [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
          ]
        }
      });
      
      console.log(`[startHandler] 💳 Upsell in ${Date.now() - t0}ms`);
      return;
    }

    // 5) Перше колесо?
    let hasFirstWheel = false;
    try {
      const { getBase, tables } = await import('../config/database.js');
      const base = getBase();
      
      const records = await base(tables.WHEEL_BALANCE)
        .select({
          filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
          maxRecords: 1
        })
        .firstPage();
      
      hasFirstWheel = records.length > 0;
    } catch (e) {
      console.warn(`[startHandler] ⚠️ checkFirstWheel: ${e?.message || e}`);
    }
    
    console.log(`[startHandler] 🎯 hasFirstWheel=${hasFirstWheel}`);

    if (!hasFirstWheel) {
      const userName = user?.['User Name'] || name;
      const msg =
        `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
        `Привіт, ${userName}! 👋\n\n` +
        `Рекомендую почати з колеса балансу — так AI зможе давати тобі **персоналізовані** підказки і стратегії.\n\n` +
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

    // 6) Все ок → тепле повернення + повне меню
    const userName = user['User Name'] || name;
    const subscriptionStatus = user['Active_Subscription_Status'] || '✅ Активна';
    
    const contMsg =
      `👋 Раді бачити знову, ${userName}!\n\n` +
      `${subscriptionStatus}\n\n` +
      `Продовжимо твій розвиток? 🚀`;
    
    await ctx.reply(contMsg, {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
          [{ text: '💎 Афірмація' }, { text: '📊 Мій прогрес' }],
          [{ text: '💰 Підписка' }, { text: '❓ Допомога' }],
          [{ text: '📝 Інструкції' }, { text: '📞 Зв\'язок з нами' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true
      }
    });
    
    // Оновлюємо активність
    try {
      await userService.updateUser(tgId, { 
        Last_Activity: new Date().toISOString() 
      });
    } catch (error) {
      console.warn('Помилка оновлення активності:', error);
    }
    
    console.log(`[startHandler] ✅ Main menu in ${Date.now() - t0}ms`);
  }
};

export default startHandler;