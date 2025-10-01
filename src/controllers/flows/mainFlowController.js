// src/controllers/flows/mainFlowController.js - ВИПРАВЛЕНО: ОБРОБКА ВСІХ КНОПОК

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import typing from '../../utils/typing.js';
import { aiMentorSession } from '../../aiMentor/session.js';

// Контролери
import wheelController from './wheelController.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import subscriptionController from '../subscriptionController.js';
import reportService from '../../services/reportService.js';
import sessionHandler from '../handlers/sessionHandler.js';

const mainFlowController = {
  
  // ===== /start =====
  async handleStart(ctx) {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    console.log(`[MAIN FLOW] 🚀 Start: ${tgId} (${name})`);

    try {
      const user = await userService.getUserByTgId(tgId);

      if (!user) {
        console.log(`[MAIN FLOW] 🆕 Новий: ${tgId}`);
        await this.startRegistration(ctx, name);
        return;
      }

      if (!user.UserRegistered || !user['User Name'] || !user.Email) {
        console.log(`[MAIN FLOW] ⚠️ Незавершена реєстрація: ${tgId}`);
        await this.startRegistration(ctx, name);
        return;
      }

      const hasAccess = userService.hasActiveAccess(user);
      console.log(`[MAIN FLOW] 💰 Підписка ${tgId}: ${hasAccess ? 'ТАК' : 'НІ'}`);

      if (!hasAccess) {
        await this.showSubscriptionRequired(ctx, user);
        return;
      }

      const activeSession = await sessionHandler.isActiveSession(tgId);
      if (activeSession) {
        await sessionHandler.handleBlockedMenu(ctx);
        return;
      }

      const hasWheel = await this.checkFirstWheel(tgId);
      console.log(`[MAIN FLOW] 🎯 Колесо ${tgId}: ${hasWheel ? 'ТАК' : 'НІ'}`);

      if (!hasWheel) {
        await this.showFirstWheel(ctx, user);
        return;
      }

      console.log(`[MAIN FLOW] ✅ Меню: ${tgId}`);
      await this.showMainMenu(ctx, user);

    } catch (error) {
      console.error('[MAIN FLOW] ❌ handleStart:', error);
      await ctx.reply('❌ Помилка. Спробуй /start', keyboards.emergencyKeyboard());
    }
  },

  // ===== ТЕКСТ =====
  async handleText(ctx, text, user) {
    const tgId = ctx.from.id;
    console.log(`[MAIN FLOW] 💬 "${text}" від ${tgId}`);

    const hasAccess = userService.hasActiveAccess(user);

    switch (text) {
      case '🤖 AI наставник':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'AI наставник');
          return;
        }
        await aiMentorController.handleAIMentorRequest(ctx);
        break;
        
      case '🎯 Колесо балансу':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'Колесо балансу');
          return;
        }
        await wheelController.handleRequest(ctx);
        break;
        
      case '💰 Підписка':
        await subscriptionController.handleSubscriptionInfo(ctx);
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
        await typing(ctx, 2000);
        await this.generateWeeklyReport(ctx, tgId);
        break;
        
      case '📈 Щомісячний звіт':
        if (!hasAccess) {
          await this.showFeatureBlocked(ctx, 'Щомісячний звіт');
          return;
        }
        await typing(ctx, 2000);
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
        console.log(`[MAIN FLOW] ❓ Невідома: "${text}"`);
        await ctx.reply('❓ Не розпізнав команду', keyboards.mainMenuKeyboard());
    }
  },

  // ===== CALLBACK =====
  async handleCallback(ctx, data, user) {
    const tgId = ctx.from.id;
    console.log(`[MAIN FLOW] 📱 Callback: ${data} від ${tgId}`);

    try {
      switch (data) {
        case 'main_menu':
        case 'open_main':
          const currentUser = user || await userService.getUserByTgId(tgId);
          await this.showMainMenu(ctx, currentUser);
          await ctx.answerCbQuery();
          break;
          
        case 'continue_session':
          const userStep = user?.Answer_Step;
          
          if (aiMentorSession.isActive?.(tgId)) {
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
            await ctx.reply('💬 Продовжуємо діалог. Напиши питання!');
          } else if (userStep === 'WheelBalance') {
            await wheelController.handleCallback(ctx, 'wheel_continue');
          } else if (userStep?.startsWith('Q_m_')) {
            const dailyController = await import('./dailyController.js');
            await dailyController.default.handleCallback(ctx, 'start_morning');
          } else if (userStep?.startsWith('Q_e_')) {
            const dailyController = await import('./dailyController.js');
            await dailyController.default.handleCallback(ctx, 'start_evening');
          }
          
          await ctx.answerCbQuery('Продовжуємо');
          break;
          
        case 'my_progress':
          const progressUser = user || await userService.getUserByTgId(tgId);
          await this.showProgress(ctx, progressUser);
          await ctx.answerCbQuery();
          break;
          
        case 'get_weekly_report':
          await typing(ctx, 2000);
          await this.generateWeeklyReport(ctx, tgId);
          await ctx.answerCbQuery();
          break;
          
        case 'get_monthly_report':
          await typing(ctx, 2000);
          await this.generateMonthlyReport(ctx, tgId);
          await ctx.answerCbQuery();
          break;
          
        case 'show_affirmation':
          await this.showAffirmation(ctx);
          await ctx.answerCbQuery();
          break;
          
        case 'help':
          await this.showHelp(ctx);
          await ctx.answerCbQuery();
          break;
          
        case 'contact':
          await this.showContact(ctx);
          await ctx.answerCbQuery();
          break;
          
        case 'instructions':
          await this.showInstructions(ctx);
          await ctx.answerCbQuery();
          break;
          
        default:
          console.log(`[MAIN FLOW] ❓ Невідомий callback: ${data}`);
          await ctx.answerCbQuery('Команда не розпізнана');
      }
    } catch (error) {
      console.error('[MAIN FLOW] ❌ Callback:', error);
      await ctx.answerCbQuery('Помилка');
    }
  },

  // ===== ДОПОМІЖНІ =====

  async startRegistration(ctx, name) {
    const message = 
      `👋 Привіт, ${name}!\n\n` +
      `Я твій AI-коуч! Допомагаю:\n\n` +
      `🎯 Досягати цілі\n` +
      `⚖️ Знаходити баланс\n` +
      `💪 Тримати мотивацію\n` +
      `📈 Відслідковувати прогрес\n\n` +
      `Готова розпочати?`;

    await ctx.reply(message, keyboards.greetingKeyboard());
  },

  async showSubscriptionRequired(ctx, user) {
    const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
    
    const message = 
      `👋 Привіт, ${userName}!\n\n` +
      `💡 Для доступу потрібна підписка:\n\n` +
      `🎯 AI коучинг 24/7\n` +
      `📊 Колесо балансу\n` +
      `📈 Аналітика\n\n` +
      `Активуй підписку:`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Trial 7 днів', callback_data: 'activate_trial' }],
          [{ text: '💰 Плани', callback_data: 'subscription_plans' }],
          [{ text: '🔄 Оновити', callback_data: 'sync_subscription' }]
        ]
      }
    });
  },

  async showFirstWheel(ctx, user) {
    const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
    
    const message = 
      `🎯 ПЕРШЕ КОЛЕСО\n\n` +
      `${userName}, щоб персоналізувати AI-наставника, заповни колесо балансу.\n\n` +
      `📊 8 сфер життя (5-10 хв)\n` +
      `🎯 Персональні рекомендації\n\n` +
      `Готова?`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Почати', callback_data: 'wheel_start' }],
          [{ text: '❓ Інфо', callback_data: 'wheel_info' }],
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
      `Обери дію з меню або очікуй:\n\n` +
      `🌞 Ранкові питання — щодня о 08:00\n` +
      `🌙 Вечірні питання — щодня о 21:30\n` +
      `📊 Щотижневі звіти — щонеділі\n` +
      `🎯 Щомісячне колесо — 1-го числа\n\n` +
      `💡 Використовуй AI наставника 24/7`;

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    
    userService.updateUserFields(ctx.from.id, { 
      Last_Activity: new Date().toISOString() 
    }).catch(() => {});
  },

  async showFeatureBlocked(ctx, name) {
    await ctx.reply(
      `🚫 ${name} недоступний\n\n` +
      `Потрібна активна підписка.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial 7 днів', callback_data: 'activate_trial' }],
            [{ text: '💰 Плани', callback_data: 'subscription_plans' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  },

  async showProgress(ctx, user) {
    const message = 
      `📊 ТВІЙ ПРОГРЕС\n\n` +
      `Статистика та досягнення.\n\n` +
      `Дані оновлюються після кожної сесії.`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Колесо', callback_data: 'wheel_stats' }],
          [{ text: '🤖 AI діалоги', callback_data: 'ai_report' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    });
  },

  async generateWeeklyReport(ctx, tgId) {
    try {
      await ctx.reply('📊 Генерую щотижневий звіт...');
      
      const report = await reportService.generateReport(tgId, 7);
      await ctx.reply(`📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n${report}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📈 Щомісячний', callback_data: 'get_monthly_report' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('[MAIN FLOW] Помилка звіту:', error);
      await ctx.reply('❌ Помилка генерації. Спробуй пізніше.');
    }
  },

  async generateMonthlyReport(ctx, tgId) {
    try {
      await ctx.reply('📅 Генерую щомісячний звіт...');
      
      const report = await reportService.generateReport(tgId, 30);
      await ctx.reply(`📅 ЩОМІСЯЧНИЙ ЗВІТ\n\n${report}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Нове колесо', callback_data: 'wheel_start' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('[MAIN FLOW] Помилка звіту:', error);
      await ctx.reply('❌ Помилка генерації. Спробуй пізніше.');
    }
  },

  async showAffirmation(ctx) {
    const affirmations = [
      'Моя енергія створює позитивні зміни',
      'Я заслуговую на все найкраще', 
      'Моя рішучість творить можливості',
      'Щодня впевнено йду до мети',
      'Дія — мова проти страху',
      'Кожне рішення прокачує рішучість',
      'Впевненість і рішучість — мої інструменти'
    ];
    
    const random = affirmations[Math.floor(Math.random() * affirmations.length)];
    await ctx.reply(`✨ ${random}`, keyboards.mainMenuKeyboard());
  },

  async showHelp(ctx) {
    const message = 
      `❓ ДОПОМОГА\n\n` +
      `При питаннях:\n\n` +
      `📧 nadyastarway@gmail.com\n` +
      `💬 @Nadya2316\n\n` +
      `⏰ Відповідь 2-4 год у робочі дні`;
        
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  },

  async showContact(ctx) {
    const message = 
      `📞 КОНТАКТИ\n\n` +
      `💬 ТЕХПІДТРИМКА:\n` +
      `Email: nadyastarway@gmail.com\n` +
      `@Nadya2316 (ментор)\n` +
      `@vira_333 (техпідтримка)\n\n` +
      `📋 ПІДПИСКА:\n` +
      `Telegram ID: ${ctx.from.id}\n\n` +
      `⏰ Відповідь 2-4 год`;
        
    await ctx.reply(message, keyboards.mainMenuKeyboard());
  },

  async showInstructions(ctx) {
    const message = 
      `📝 ІНСТРУКЦІЯ\n\n` +
      `🚀 ПОЧАТОК:\n` +
      `/start → реєстрація → підписка → колесо\n\n` +
      `📊 ЩОДНЯ:\n` +
      `🌞 Ранкові (08:00)\n` +
      `🌙 Вечірні (21:30)\n` +
      `🤖 AI наставник\n\n` +
      `📈 АНАЛІТИКА:\n` +
      `📊 Щотижневі звіти\n` +
      `📅 Щомісячні звіти\n` +
      `🎯 Колесо (щомісяця)\n\n` +
      `💡 Відповідай щиро`;
        
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
      console.error('[MAIN FLOW] Помилка колеса:', error);
      return false;
    }
  }
};

export default mainFlowController;