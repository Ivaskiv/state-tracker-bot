// src/controllers/flows/mainFlowController.js - ВИПРАВЛЕНО

import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import typing from '../../utils/typing.js';

const mainFlowController = {
  
  // ===== ОБРОБКА /start =====
  async handleStart(ctx) {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    console.log(`[MAIN FLOW] 🚀 Start для ${tgId} (${name})`);

    try {
      await typing(ctx, 1000);

      // Отримуємо користувача
      let user = null;
      try {
        user = await userService.getUserByTelegramId(tgId);
      } catch (error) {
        console.warn(`[MAIN FLOW] ⚠️ Помилка отримання користувача ${tgId}:`, error.message);
      }

      // СЦЕНАРІЙ 1: Користувач не існує - реєстрація
      if (!user) {
        console.log(`[MAIN FLOW] 🆕 Новий користувач ${tgId} - запуск реєстрації`);
        await this.startRegistration(ctx, name);
        return;
      }

      // СЦЕНАРІЙ 2: Користувач не завершив реєстрацію
      if (!user.UserRegistered || !user['User Name'] || !user.Email) {
        console.log(`[MAIN FLOW] ⚠️ Користувач ${tgId} не завершив реєстрацію`);
        await this.startRegistration(ctx, name);
        return;
      }

      // СЦЕНАРІЙ 3: Перевіряємо підписку
      const hasAccess = userService.hasActiveAccess(user);
      console.log(`[MAIN FLOW] 💰 Підписка для ${tgId}: ${hasAccess ? 'АКТИВНА' : 'НЕАКТИВНА'}`);

      if (!hasAccess) {
        await this.showSubscriptionRequired(ctx, user);
        return;
      }

      // СЦЕНАРІЙ 4: Перевіряємо перше колесо балансу
      const hasWheel = await this.checkFirstWheel(tgId);
      console.log(`[MAIN FLOW] 🎯 Перше колесо для ${tgId}: ${hasWheel ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'}`);

      if (!hasWheel) {
        await this.showFirstWheel(ctx, user);
        return;
      }

      // СЦЕНАРІЙ 5: Все готово - головне меню
      console.log(`[MAIN FLOW] ✅ Все готово для ${tgId} - показуємо головне меню`);
      await this.showMainMenu(ctx, user);

    } catch (error) {
      console.error('[MAIN FLOW] ❌ Помилка handleStart:', error);
      await ctx.reply('❌ Помилка запуску. Спробуй ще раз /start', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ОБРОБКА ТЕКСТУ =====
  async handleText(ctx, text, user) {
    const tgId = ctx.from.id;
    
    console.log(`[MAIN FLOW] 💬 Обробка команди "${text}" від ${tgId}`);

    const hasAccess = userService.hasActiveAccess(user);

    switch (text) {
      case '🤖 AI наставник':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'AI наставник');
          return;
        }
        const aiMentorController = await import('../../aiMentor/controllers/aiMentorController.js');
        await aiMentorController.default.handleAIMentorRequest(ctx);
        break;
        
      case '🎯 Колесо балансу':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'Колесо балансу');
          return;
        }
        const wheelController = await import('./wheelController.js');
        await wheelController.default.handleRequest(ctx);
        break;
        
      case '💰 Підписка':
        const subscriptionController = await import('../subscriptionController.js');
        await subscriptionController.default.handleSubscriptionInfo(ctx);
        break;
        
      case '💎 Афірмація':
        await this.showAffirmation(ctx);
        break;
        
      case '📊 Мій прогрес':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'Прогрес');
          return;
        }
        await this.showProgress(ctx, user);
        break;
        
      case '📈 Щотижневий звіт':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'Щотижневий звіт');
          return;
        }
        await this.generateWeeklyReport(ctx, tgId);
        break;
        
      case '📈 Щомісячний звіт':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'Щомісячний звіт');
          return;
        }
        await this.generateMonthlyReport(ctx, tgId);
        break;
        
      case '❓ Допомога':
        await this.showHelp(ctx);
        break;
        
      case '📞 Зв\'язок з нами':
        await this.showContact(ctx);
        break;
        
      case '📝 Інструкції':
        await this.showInstructions(ctx);
        break;
        
      default:
        console.log(`[MAIN FLOW] ❓ Невідома команда: "${text}"`);
        await ctx.reply('❓ Не розпізнав команду. Обери з меню нижче:', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ОБРОБКА CALLBACK =====
  async handleCallback(ctx, data, user) {
    const tgId = ctx.from.id;
    
    console.log(`[MAIN FLOW] 📱 Callback: ${data} від ${tgId}`);

    try {
      switch (data) {
        case 'main_menu':
          const currentUser = user || await userService.getUserByTelegramId(tgId);
          await this.showMainMenu(ctx, currentUser);
          break;
          
        case 'my_progress':
          const progressUser = user || await userService.getUserByTelegramId(tgId);
          await this.showProgress(ctx, progressUser);
          break;
          
        case 'get_weekly_report':
          await this.generateWeeklyReport(ctx, tgId);
          break;
          
        case 'get_monthly_report':
          await this.generateMonthlyReport(ctx, tgId);
          break;
          
        case 'show_affirmation':
          await this.showAffirmation(ctx);
          break;
          
        case 'help':
          await this.showHelp(ctx);
          break;
          
        case 'contact':
          await this.showContact(ctx);
          break;
          
        case 'instructions':
          await this.showInstructions(ctx);
          break;
          
        default:
          console.log(`[MAIN FLOW] ❓ Невідомий callback: ${data}`);
          await ctx.answerCbQuery('Команда не розпізнана');
      }
    } catch (error) {
      console.error('[MAIN FLOW] ❌ Помилка callback:', error);
    }
  },

  // ===== ДОПОМІЖНІ МЕТОДИ =====

  async startRegistration(ctx, name) {
    const message = 
      `👋 Привіт, ${name}!\n\n` +
      `Я твій AI-мотиватор та коуч! Допомагаю:\n\n` +
      `🎯 Ставити та досягати цілі\n` +
      `⚖️ Знаходити баланс у житті\n` +
      `💪 Підтримувати мотивацію\n` +
      `📈 Відслідковувати прогрес\n\n` +
      `Готова розпочати?`;

    await ctx.reply(message, keyboards.greetingKeyboard());
  },

  async showSubscriptionRequired(ctx, user) {
    const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
    
    const message = 
      `👋 З поверненням, ${userName}!\n\n` +
      `💡 Для повного доступу потрібна активна підписка:\n\n` +
      `🎯 AI коучинг 24/7\n` +
      `📊 Колесо балансу\n` +
      `📈 Персональна аналітика\n\n` +
      `💰 Активуй підписку:`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
          [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
          [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
        ]
      }
    });
  },

  async showFirstWheel(ctx, user) {
    const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
    
    const message = 
      `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
      `Привіт, ${userName}! 👋\n\n` +
      `Рекомендую почати з колеса балансу 🌀\n` +
      `Це допоможе AI-наставнику дати тобі максимально ` +
      `персоналізовані підказки та рекомендації.\n\n` +
      `📊 8 сфер життя (5–10 хв)\n` +
      `🎯 Отримаєш інсайти та план дій\n\n` +
      `Готова почати?`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' }],
          [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }],
          [{ text: '⏭ Пізніше', callback_data: 'main_menu' }]
        ]
      }
    });
  },

  async showMainMenu(ctx, user) {
    const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
    const status = user?.['Active_Subscription_Status'] || '✅ Активна';
    
    const message = 
      `🏠 Головне меню\n\n` +
      `👋 ${userName}\n` +
      `${status}\n\n` +
      `Готова до продуктивного дня?`;

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    
    // Оновлюємо активність в фоні
    userService.updateUser(ctx.from.id, { 
      Last_Activity: new Date().toISOString() 
    }).catch(error => console.warn('Помилка оновлення активності:', error));
  },

  async showFeatureBlocked(ctx, featureName) {
    await ctx.reply(
      `🚫 ${featureName} недоступний\n\n` +
      `❌ Потрібна активна підписка.\n\n` +
      `💰 Активуй підписку:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
            [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  },

  async showProgress(ctx, user) {
    await typing(ctx);
    
    const message = 
      `📊 ТВІЙ ПРОГРЕС\n\n` +
      `Тут відображається твоя статистика та досягнення.\n\n` +
      `📈 Дані оновлюються після кожної сесії.`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Колесо балансу', callback_data: 'wheel_stats' }],
          [{ text: '🤖 AI діалоги', callback_data: 'ai_report' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    });
  },

  async generateWeeklyReport(ctx, tgId) {
    await typing(ctx, 2000);
    
    try {
      await ctx.reply('📊 Генерую щотижневий звіт...');
      
      const reportService = await import('../../services/reportService.js');
      const report = await reportService.default.generateReport(tgId, 7);
      
      const message = `📊 ЩОТИЖНЕВИЙ AI-ЗВІТ\n\n${report}`;
      
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📈 Щомісячний звіт', callback_data: 'get_monthly_report' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('[MAIN FLOW] Помилка щотижневого звіту:', error);
      await ctx.reply('❌ Помилка генерації звіту. Спробуй пізніше.');
    }
  },

  async generateMonthlyReport(ctx, tgId) {
    await typing(ctx, 2000);
    
    try {
      await ctx.reply('📅 Генерую щомісячний звіт...');
      
      const reportService = await import('../../services/reportService.js');
      const report = await reportService.default.generateReport(tgId, 30);
      
      const message = `📅 ЩОМІСЯЧНИЙ AI-ЗВІТ\n\n${report}`;
      
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Нове колесо балансу', callback_data: 'wheel_start' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('[MAIN FLOW] Помилка щомісячного звіту:', error);
      await ctx.reply('❌ Помилка генерації звіту. Спробуй пізніше.');
    }
  },

  async showAffirmation(ctx) {
    const affirmations = [
      'Моя енергія створює позитивні зміни',
      'Я заслуговую на все найкраще прямо зараз', 
      'Моя рішучість творить нові можливості',
      'Щодня я впевнено просуваюся до мети',
      'Дія — це моя мова проти страху',
      'Кожне рішення прокачує мою рішучість',
      'Впевненість і рішучість — мої інструменти'
    ];
    
    const randomAffirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
    
    await ctx.reply(`✨ ${randomAffirmation}`, keyboards.mainMenuKeyboard());
  },

  async showHelp(ctx) {
    const message = 
      `❓ ДОПОМОГА\n\n` +
      `При питаннях або технічних проблемах:\n\n` +
      `📧 Email: nadyastarway@gmail.com\n` +
      `💬 Telegram: @Nadya2316\n\n` +
      `⏰ Відповідаємо протягом 2-4 годин у робочі дні.`;
        
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  },

  async showContact(ctx) {
    const message = 
      `📞 ЗВ'ЯЗОК З НАМИ\n\n` +
      `💬 **ТЕХПІДТРИМКА:**\n` +
      `Email: nadyastarway@gmail.com\n` +
      `Telegram: @Nadya2316 (ментор)\n` +
      `Telegram: @vira_333 (техпідтримка)\n\n` +
      `📋 **ПИТАННЯ ПРО ПІДПИСКУ:**\n` +
      `Пишіть з вказівкою Telegram ID: ${ctx.from.id}\n\n` +
      `⏰ **ЧАС ВІДПОВІДІ:**\n` +
      `2-4 години у робочі дні`;
        
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  },

  async showInstructions(ctx) {
    const message = 
      `📝 ЯК КОРИСТУВАТИСЯ\n\n` +
      `🚀 **ПОЧАТОК:**\n` +
      `/start → реєстрація → підписка → колесо балансу\n\n` +
      `📊 **ЩОДНЯ:**\n` +
      `🌞 Ранкові питання (08:00)\n` +
      `🌙 Вечірні питання (21:30)\n` +
      `🤖 AI наставник для підтримки\n\n` +
      `📈 **АНАЛІТИКА:**\n` +
      `📊 Щотижневі звіти\n` +
      `📅 Щомісячні звіти\n` +
      `🎯 Колесо балансу (щомісяця)\n\n` +
      `💡 Відповідай щиро, використовуй AI наставника`;
        
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  },

  async checkFirstWheel(tgId) {
    try {
      const { getBase, tables } = await import('../../config/database.js');
      const base = getBase();
      
      const records = await base(tables.WHEEL_BALANCE)
        .select({
          filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
          maxRecords: 1
        })
        .firstPage();
      
      return records.length > 0;
    } catch (error) {
      console.error('[MAIN FLOW] Помилка перевірки колеса:', error);
      return false;
    }
  }
};

export default mainFlowController;