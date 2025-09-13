// src/controllers/menuHandlers.js - СТВОРИТИ НОВИЙ ФАЙЛ
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import { isActiveSubscription, restrictAccessMessage } from '../../utils/subscriptionUtils.js';
import { handleError } from '../../utils/errorHandler.js';
import { MENU_TEXTS } from '../../config/constants.js';
import keyboards from '../../utils/keyboards.js';
import responseService from '../services/responseService.js';
import logger from '../../utils/logger.js';
import affirmationService from '../services/affirmationService.js';
import { sendReport } from '../../services/reportService.js';
import userService from '../../auth/services/userService.js';

// Головна функція обробки команд меню
const handleMenuCommands = async (ctx, user, text, bot) => {
  logger.info(`📋 [MENU] Обробка команди: "${text}"`);

  // AI наставник
  if (text === '🤖 AI наставник') {
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('🤖 AI-наставник', ctx);
    }
    return await aiMentorController.handleAIMentorRequest(ctx);
  }

  // Колесо балансу
  if (text === '🎯 Колесо балансу') {
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('🎯 Колесо балансу', ctx);
    }
    
    // Показуємо останній результат або запускаємо нове
    const stats = await wheelBalanceService.getUserWheelStats(ctx.from.id);
    
    if (stats.total > 0 && stats.lastScore) {
      // Показуємо останній результат
      const lastDate = new Date(stats.lastDate).toLocaleDateString('uk-UA');
      const resultMessage = `🎯 ТВОЄ ОСТАННЄ КОЛЕСО БАЛАНСУ\n\n📅 Дата: ${lastDate}\n📊 Загальний бал: ${stats.lastScore}/10\n\n${stats.records[0].AI_Analysis || 'Аналіз недоступний'}\n\n💡 Хочеш пройти знову?`;
      
      return await ctx.reply(resultMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Пройти знову', callback_data: 'wheel_start_new' }],
            [{ text: '🏠 Головне меню', callback_data: 'wheel_to_menu' }]
          ]
        }
      });
    } else {
      // Запускаємо нове колесо
      await userService.updateUserStep(ctx.from.id, 'WheelBalance');
      return await wheelBalanceController.handleWheelBalanceRequest(ctx);
    }
  }

  // Афірмації
  if (text === '💎 Афірмація') {
    const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
    return await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
  }

  // Звіти
  if (text === '📈 Щотижневий звіт') {
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('📋 Щотижневий звіт', ctx);
    }
    return await sendReport(bot, ctx.from.id, 'weekly');
  }

  if (text === '📈 Щомісячний звіт') {
    if (!isActiveSubscription(user)) {
      return await restrictAccessMessage('📋 Щомісячний звіт', ctx);
    }
    return await sendReport(bot, ctx.from.id, 'monthly');
  }

  // Прогрес
  if (text === '📊 Мій прогрес') {
    return await showUserProgress(ctx, user);
  }

  // Підписка
  if (text === '💰 Підписка') {
    return await showSubscriptionInfo(ctx, user);
  }

  // Допомога
  if (text === '❓ Допомога') {
    return await ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
  }

  // Контакти
  if (text === '📞 Зв\'язок з нами') {
    return await ctx.reply(MENU_TEXTS.CONTACT, keyboards.supportKeyboard());
  }

  // Інструкції
  if (text === '📝 Інструкції') {
    return await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
  }

  // Профіль
  if (text === 'ℹ️ Профіль') {
    return await showUserProfile(ctx, user);
  }

  // Якщо команда не знайдена
  logger.info(`❓ [MENU] Невідома команда: "${text}"`);
  await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
};

// Показ прогресу користувача
const showUserProgress = async (ctx, user) => {
  if (!user) {
    return await ctx.reply(MENU_TEXTS.REGISTER_FIRST, keyboards.mainMenuKeyboard());
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

    const progressText = MENU_TEXTS.PROGRESS(totalDays, morningCompleted, eveningCompleted);
    await ctx.reply(progressText, keyboards.mainMenuKeyboard());
  } catch (error) {
    await handleError(ctx, error, MENU_TEXTS.PROGRESS_UNAVAILABLE);
  }
};

// Показ інформації про підписку
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

// Показ профілю користувача
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