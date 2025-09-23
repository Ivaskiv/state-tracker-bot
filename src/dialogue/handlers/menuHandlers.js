// src/dialogue/handlers/menuHandlers.js

import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
import wheelBalanceService from '../../services/wheelBalanceService.js';
import { isActiveSubscription, restrictAccessMessage } from '../../utils/subscriptionUtils.js';
import { handleError } from '../../utils/errorHandler.js';
import { MENU_TEXTS } from '../../config/constants.js';
import keyboards from '../../utils/keyboards.js';
import responseService from '../services/responseService.js';
import logger from '../../utils/logger.js';
import affirmationService from '../services/affirmationService.js';
import { sendReport } from '../../services/reportService.js';
import userService from '../../auth/services/userService.js';
import typing from '../../utils/typing.js';

const handleMenuCommands = async (ctx, user, text, bot) => {
  logger.info(`📋 [MENU] Обробка команди: "${text}"`);
  console.log(`[MENU] 🔍 ДЕТАЛЬНА ДІАГНОСТИКА:`);
  console.log(`- Текст: "${text}"`);
  console.log(`- Користувач: ${user['User Name']}`);
  console.log(`- Підписка: ${user['Active_Subscription_Status']}`);
  console.log(`- isActiveSubscription: ${isActiveSubscription(user)}`);

  try {
    // ✅ КОЛЕСО БАЛАНСУ
    if (text === '🎯 Колесо балансу') {
      console.log(`🎯 [MENU] ЗНАЙДЕНО команду колеса балансу!`);
      
      if (!isActiveSubscription(user)) {
        console.log(`❌ [MENU] Немає активної підписки для колеса балансу`);
        return await restrictAccessMessage('🎯 Колесо балансу', ctx);
      }
      
      console.log(`✅ [MENU] Запускаємо колесо балансу для ${ctx.from.id}`);
      await typing(ctx);
      return await wheelBalanceController.handleWheelBalanceRequest(ctx);
    }

    // ✅ AI наставник
    if (text === '🤖 AI наставник') {
      console.log(`🤖 [MENU] ЗНАЙДЕНО команду AI наставника!`);
      if (!isActiveSubscription(user)) {
        return await restrictAccessMessage('🤖 AI-наставник', ctx);
      }
      await typing(ctx);
      return await aiMentorController.handleAIMentorRequest(ctx);
    }

    // ✅ Афірмації
    if (text === '💎 Афірмація') {
      console.log(`💎 [MENU] ЗНАЙДЕНО команду афірмації!`);
      await typing(ctx);
      try {
        const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
        return await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      } catch (error) {
        console.error('[MENU] Помилка афірмації:', error);
        return await ctx.reply('✨ Твоя сила всередині тебе! Дій з впевненістю.', keyboards.mainMenuKeyboard());
      }
    }

    // ✅ Звіти
    if (text === '📈 Щотижневий звіт') {
      console.log(`📈 [MENU] ЗНАЙДЕНО команду щотижневого звіту!`);
      if (!isActiveSubscription(user)) {
        return await restrictAccessMessage('📋 Щотижневий звіт', ctx);
      }
      await typing(ctx);
      try {
        return await sendReport(bot, ctx.from.id, 'weekly');
      } catch (error) {
        console.error('[MENU] Помилка тижневого звіту:', error);
        return await ctx.reply('❌ Не вдалося створити звіт. Спробуй пізніше.', keyboards.mainMenuKeyboard());
      }
    }

    if (text === '📈 Щомісячний звіт') {
      console.log(`📈 [MENU] ЗНАЙДЕНО команду щомісячного звіту!`);
      if (!isActiveSubscription(user)) {
        return await restrictAccessMessage('📋 Щомісячний звіт', ctx);
      }
      await typing(ctx);
      try {
        return await sendReport(bot, ctx.from.id, 'monthly');
      } catch (error) {
        console.error('[MENU] Помилка місячного звіту:', error);
        return await ctx.reply('❌ Не вдалося створити звіт. Спробуй пізніше.', keyboards.mainMenuKeyboard());
      }
    }

    // ✅ Прогрес
    if (text === '📊 Мій прогрес') {
      console.log(`📊 [MENU] ЗНАЙДЕНО команду прогресу!`);
      await typing(ctx);
      return await showUserProgress(ctx, user);
    }

    // ✅ Підписка
    if (text === '💰 Підписка') {
      console.log(`💰 [MENU] ЗНАЙДЕНО команду підписки!`);
      await typing(ctx);
      return await showSubscriptionInfo(ctx, user);
    }

    // ✅ Допомога
    if (text === '❓ Допомога') {
      console.log(`❓ [MENU] ЗНАЙДЕНО команду допомоги!`);
      await typing(ctx);
      return await ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
    }

    // ✅ Контакти
    if (text === '📞 Зв\'язок з нами') {
      console.log(`📞 [MENU] ЗНАЙДЕНО команду контактів!`);
      await typing(ctx);
      return await ctx.reply(MENU_TEXTS.CONTACT, keyboards.supportKeyboard());
    }

    // ✅ Інструкції
    if (text === '📝 Інструкції') {
      console.log(`📝 [MENU] ЗНАЙДЕНО команду інструкцій!`);
      await typing(ctx);
      return await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
    }

    // ✅ Профіль
    if (text === 'ℹ️ Профіль') {
      console.log(`ℹ️ [MENU] ЗНАЙДЕНО команду профілю!`);
      await typing(ctx);
      return await showUserProfile(ctx, user);
    }

    // Якщо команда не знайдена
    console.log(`❓ [MENU] НЕВІДОМА команда: "${text}"`);
    await typing(ctx);
    await ctx.reply('Оберіть пункт з меню нижче:', keyboards.mainMenuKeyboard());

  } catch (error) {
    console.error(`❌ [MENU] Критична помилка обробки "${text}":`, error);
    await typing(ctx);
    await ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

const showUserProgress = async (ctx, user) => {
  if (!user) {
    return await ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
  }

  try {
    const tgId = ctx.from.id;
    
    const records = await responseService.getUserRecords(tgId, 30);
    const totalDays = records.length;
    let morningCompleted = 0;
    let eveningCompleted = 0;

    records.forEach(({ fields = {} }) => {
      const morning = fields.affirmation_m || fields.Q_m_1 || fields.Q_m_2 || fields.Q_m_3 || fields.Q_m_4 || fields.Q_m_5 || fields.Q_m_6;
      const evening = fields.affirmation_e || fields.Q_e_1 || fields.Q_e_2 || fields.Q_e_3 || fields.Q_e_4 || fields.Q_e_5;
      if (morning) morningCompleted++;
      if (evening) eveningCompleted++;
    });

    const wheelStats = await wheelBalanceService.getUserWheelStats(tgId);
    
    let progressText = `📊 ТВІЙ ПРОГРЕС (за 30 днів)\n\n`;
    
    progressText += `📝 Щоденні рефлексії:\n`;
    progressText += `• Всього активних днів: ${totalDays}\n`;
    progressText += `• Ранкові завершено: ${morningCompleted}\n`;
    progressText += `• Вечірні завершено: ${eveningCompleted}\n\n`;
    
    progressText += `🎯 Колеса балансу:\n`;
    if (wheelStats.total === 0) {
      progressText += `• Поки що не заповнено\n`;
      progressText += `• Рекомендую почати з першого!\n\n`;
    } else {
      progressText += `• Заповнено коліс: ${wheelStats.total}\n`;
      if (wheelStats.lastScore) {
        progressText += `• Останній середній бал: ${wheelStats.lastScore}/10\n`;
      }
      if (wheelStats.lastDate) {
        const daysSince = Math.floor((new Date() - new Date(wheelStats.lastDate)) / (1000 * 60 * 60 * 24));
        progressText += `• Останнє колесо: ${daysSince} днів тому\n`;
      }
      progressText += '\n';
    }
    
    const activityPercent = totalDays > 0 ? Math.round(((morningCompleted + eveningCompleted) / (totalDays * 2)) * 100) : 0;
    
    if (activityPercent >= 80) {
      progressText += `🏆 Відмінна активність (${activityPercent}%)! Ти на правильному шляху.`;
    } else if (activityPercent >= 60) {
      progressText += `👍 Хороша активність (${activityPercent}%). Продовжуй у тому ж дусі!`;
    } else if (activityPercent >= 40) {
      progressText += `📈 Помірна активність (${activityPercent}%). Є простір для покращення.`;
    } else {
      progressText += `🎯 Активність ${activityPercent}%. Час активізуватися для кращих результатів!`;
    }
    
    progressText += `\n\n💡 Детальні AI-аналізи в розділах "📈 Щотижневий звіт" і "📈 Щомісячний звіт"`;

    await ctx.reply(progressText, keyboards.mainMenuKeyboard());
    
  } catch (error) {
    console.error('[MENU] Помилка прогресу:', error);
    await ctx.reply('📊 Прогрес тимчасово недоступний', keyboards.mainMenuKeyboard());
  }
};

const showSubscriptionInfo = async (ctx, user) => {
  try {
    const status = user['Active_Subscription_Status'] || '❌ Неактивна';
    const plan = user['Active Subscription Plan'] || 'Базовий';
    const startDate = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
    const endDate = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

    const isActive = isActiveSubscription(user);
    
    let subscriptionText = '💰 ПІДПИСКА:\n\n';
    
    if (isActive) {
      subscriptionText += `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${startDate}\n📅 Діє до: ${endDate}`;
    } else {
      subscriptionText += '❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n';
      subscriptionText += '🔹 Тиждень фокусу — 7€\n';
      subscriptionText += '🔹 Місяць дії — 30€\n';
      subscriptionText += '🔹 Рік трансформації — 300€';
    }

    await ctx.reply(subscriptionText, keyboards.subscriptionKeyboard());
    
  } catch (error) {
    console.error('[MENU] Помилка підписки:', error);
    await ctx.reply('💰 Інформація про підписку тимчасово недоступна', keyboards.mainMenuKeyboard());
  }
};

const showUserProfile = async (ctx, user) => {
  try {
    const name = user['User Name'] || 'Невідомо';
    const email = user.Email || 'Не вказано';
    const regDate = user.Created ? new Date(user.Created).toLocaleDateString('uk-UA') : 'Невідомо';
    
    const profileText = `ℹ️ ПРОФІЛЬ:\n\n👤 Ім'я: ${name}\n📧 Email: ${email}\n📅 Реєстрація: ${regDate}`;
    
    await ctx.reply(profileText, keyboards.mainMenuKeyboard());
    
  } catch (error) {
    console.error('[MENU] Помилка профілю:', error);
    await ctx.reply('ℹ️ Профіль тимчасово недоступний', keyboards.mainMenuKeyboard());
  }
};

export { 
  handleMenuCommands, 
  showUserProgress, 
  showSubscriptionInfo, 
  showUserProfile 
};
