// src/dialogue/handlers/menuHandlers.js - ВИПРАВЛЕНО ПОВНІСТЮ

import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
import { isActiveSubscription, restrictAccessMessage } from '../../utils/subscriptionUtils.js';
import { handleError } from '../../utils/errorHandler.js';
import { MENU_TEXTS } from '../../config/constants.js';
import keyboards from '../../utils/keyboards.js';
import responseService from '../services/responseService.js';
import logger from '../../utils/logger.js';
import affirmationService from '../services/affirmationService.js';
import { sendReport } from '../../services/reportService.js';
import userService from '../../auth/services/userService.js';

const handleMenuCommands = async (ctx, user, text, bot) => {
  logger.info(`📋 [MENU] Обробка команди: "${text}"`);
  console.log(`[MENU] 🔍 ДЕТАЛЬНА ДІАГНОСТИКА:`);
  console.log(`- Текст: "${text}"`);
  console.log(`- Користувач: ${user['User Name']}`);
  console.log(`- Підписка: ${user['Active_Subscription_Status']}`);
  console.log(`- isActiveSubscription: ${isActiveSubscription(user)}`);

  // ✅ КОЛЕСО БАЛАНСУ - ПЕРШОЧЕРГОВА ОБРОБКА
  if (text === '🎯 Колесо балансу') {
    console.log(`🎯 [MENU] ЗНАЙДЕНО команду колеса балансу!`);
    
    if (!isActiveSubscription(user)) {
      console.log(`❌ [MENU] Немає активної підписки для колеса балансу`);
      return await restrictAccessMessage('🎯 Колесо балансу', ctx);
    }
    
    console.log(`✅ [MENU] Запускаємо колесо балансу для ${ctx.from.id}`);
    return await wheelBalanceController.handleWheelBalanceRequest(ctx);
  }

  // AI наставник
  if (text === '🤖 AI наставник') {
    console.log(`🤖 [MENU] ЗНАЙДЕНО команду AI наставника!`);
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('🤖 AI-наставник', ctx);
    }
    return await aiMentorController.handleAIMentorRequest(ctx);
  }

  // Афірмації
  if (text === '💎 Афірмація') {
    console.log(`💎 [MENU] ЗНАЙДЕНО команду афірмації!`);
    const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
    return await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
  }

  // Звіти
  if (text === '📈 Щотижневий звіт') {
    console.log(`📈 [MENU] ЗНАЙДЕНО команду щотижневого звіту!`);
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('📋 Щотижневий звіт', ctx);
    }
    return await sendReport(bot, ctx.from.id, 'weekly');
  }

  if (text === '📈 Щомісячний звіт') {
    console.log(`📈 [MENU] ЗНАЙДЕНО команду щомісячного звіту!`);
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('📋 Щомісячний звіт', ctx);
    }
    return await sendReport(bot, ctx.from.id, 'monthly');
  }

  // Прогрес
  if (text === '📊 Мій прогрес') {
    console.log(`📊 [MENU] ЗНАЙДЕНО команду прогресу!`);
    return await showUserProgress(ctx, user);
  }

  // Підписка
  if (text === '💰 Підписка') {
    console.log(`💰 [MENU] ЗНАЙДЕНО команду підписки!`);
    return await showSubscriptionInfo(ctx, user);
  }

  // Допомога
  if (text === '❓ Допомога') {
    console.log(`❓ [MENU] ЗНАЙДЕНО команду допомоги!`);
    return await ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
  }

  // Контакти
  if (text === '📞 Зв\'язок з нами') {
    console.log(`📞 [MENU] ЗНАЙДЕНО команду контактів!`);
    return await ctx.reply(MENU_TEXTS.CONTACT, keyboards.supportKeyboard());
  }

  // Інструкції
  if (text === '📝 Інструкції') {
    console.log(`📝 [MENU] ЗНАЙДЕНО команду інструкцій!`);
    return await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
  }

  // Профіль
  if (text === 'ℹ️ Профіль') {
    console.log(`ℹ️ [MENU] ЗНАЙДЕНО команду профілю!`);
    return await showUserProfile(ctx, user);
  }

  // Якщо команда не знайдена
  console.log(`❓ [MENU] НЕВІДОМА команда: "${text}"`);
  console.log(`[MENU] Доступні команди:`);
  console.log(`- "🤖 AI наставник"`);
  console.log(`- "🎯 Колесо балансу"`);
  console.log(`- "💎 Афірмація"`);
  console.log(`- "📈 Щотижневий звіт"`);
  console.log(`- "📈 Щомісячний звіт"`);
  console.log(`- "📊 Мій прогрес"`);
  console.log(`- "💰 Підписка"`);
  console.log(`- "❓ Допомога"`);
  console.log(`- "📞 Зв'язок з нами"`);
  console.log(`- "📝 Інструкції"`);
  console.log(`- "ℹ️ Профіль"`);
  
  await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
};

const showUserProgress = async (ctx, user) => {
  if (!user) {
    return await ctx.reply(MENU_TEXTS.REGISTER_FIRST, keyboards.mainMenuKeyboard());
  }

  try {
    const tgId = ctx.from.id;
    
    // Отримуємо статистику відповідей
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

    // Отримуємо статистику коліс
    const wheelStats = await wheelBalanceService.getUserWheelStats(tgId);
    
    let progressText = `📊 ТВІЙ ПРОГРЕС (за 30 днів)\n\n`;
    
    // Статистика питань-відповідей
    progressText += `📝 Щоденні рефлексії:\n`;
    progressText += `• Всього активних днів: ${totalDays}\n`;
    progressText += `• Ранкові завершено: ${morningCompleted}\n`;
    progressText += `• Вечірні завершено: ${eveningCompleted}\n\n`;
    
    // Статистика коліс балансу
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
    
    // Загальна оцінка активності
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
    await handleError(ctx, error, MENU_TEXTS.PROGRESS_UNAVAILABLE);
  }
};

const showSubscriptionInfo = async (ctx, user) => {
  try {
    const status = user['Active_Subscription_Status'] || '❌ Неактивна';
    const plan = user['Active Subscription Plan'] || 'Базовий';
    const startDate = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
    const endDate = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

    const isActive = isActiveSubscription(user);
    const subscriptionText = isActive 
      ? MENU_TEXTS.SUBSCRIPTION_ACTIVE(plan, startDate, endDate)
      : MENU_TEXTS.SUBSCRIPTION_INACTIVE;

    const keyboard = isActive ? keyboards.mainMenuKeyboard() : keyboards.subscriptionKeyboard();
    await ctx.reply(subscriptionText, keyboard);
  } catch (error) {
    await handleError(ctx, error, MENU_TEXTS.SUBSCRIPTION_UNAVAILABLE);
  }
};

const showUserProfile = async (ctx, user) => {
  try {
    const tgId = ctx.from.id;
    const name = user['User Name'] || 'Користувач';
    const email = user['Email'] || 'Не вказано';
    const status = user['Active_Subscription_Status'] || '❌ Неактивна';
    const plan = user['Active Subscription Plan'] || 'Базовий';
    
    const profileText = `ℹ️ ТВІЙ ПРОФІЛЬ\n\n👤 Ім'я: ${name}\n📧 Email: ${email}\n🆔 ID: ${tgId}\n💰 План: ${plan}\n📅 Статус: ${status}`;
    await ctx.reply(profileText, keyboards.mainMenuKeyboard());
  } catch (error) {
    await handleError(ctx, error, 'ℹ️ Інформація про профіль тимчасово недоступна');
  }
};

export { handleMenuCommands };