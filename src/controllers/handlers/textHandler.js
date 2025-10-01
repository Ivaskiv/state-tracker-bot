// src/controllers/handlers/textHandler.js - ВИПРАВЛЕНИЙ РОУТИНГ МЕНЮ

import startHandler from './startHandler.js';
import userService from '../../services/userService.js';
import dailyController from '../flows/dailyController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import subscriptionController from '../subscriptionController.js';
import reportService from '../../services/reportService.js';
import { aiMentorSession } from '../../aiMentor/session.js';
import keyboards from '../../utils/keyboards.js';
import typing from '../../utils/typing.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS, CONTACTS } from '../../config/constants.js';

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  if (!text) return;
  
  console.log(`[textHandler] "${text}" від ${tgId}`);
  
  try {
    // 1. ОНБОРДИНГ
    if (await startHandler.handleText(ctx)) return;
    
    // 2. ОТРИМАННЯ КОРИСТУВАЧА
    const user = await userService.getUserByTgId(tgId);
    if (!user || !user.UserRegistered) {
      await ctx.reply('Спочатку зареєструйся /start');
      return;
    }
    
    const step = user.Answer_Step;
    
    // 3. AI НАСТАВНИК (якщо активний)
    if (aiMentorSession.isActive?.(tgId)) {
      await aiMentorController.handleAIMentorQuestion(ctx, text);
      return;
    }
    
    // 4. КОЛЕСО БАЛАНСУ
    if (step === 'WheelBalance') {
      await wheelController.handleText(ctx, text);
      return;
    }
    
    // 5. ЩОДЕННІ ПИТАННЯ
    if (step?.startsWith('Q_m_') || step?.startsWith('Q_e_')) {
      await dailyController.handleText(ctx, text, step);
      return;
    }
    
    // 6. КОМАНДИ МЕНЮ
    const hasAccess = userService.hasActiveAccess(user);
    
    await handleMenuCommands(ctx, text, user, hasAccess);
    
  } catch (error) {
    console.error('[textHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
  }
};

// ===== ОБРОБКА КОМАНД МЕНЮ =====
const handleMenuCommands = async (ctx, text, user, hasAccess) => {
  const tgId = ctx.from.id;
  
  switch (text) {
    // ===== AI НАСТАВНИК =====
    case '🤖 AI наставник':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'AI наставник');
        return;
      }
      await aiMentorController.handleAIMentorRequest(ctx);
      break;
      
    // ===== КОЛЕСО БАЛАНСУ =====
    case '🎯 Колесо балансу':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Колесо балансу');
        return;
      }
      await wheelController.handleRequest(ctx);
      break;
      
    // ===== ПІДПИСКА =====
    case '💰 Підписка':
      await subscriptionController.handleSubscriptionInfo(ctx);
      break;
      
    // ===== АФІРМАЦІЯ =====
    case '💎 Афірмація':
      const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      break;
      
    // ===== МІЙ ПРОГРЕС =====
    case '📊 Мій прогрес':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Прогрес');
        return;
      }
      await showProgress(ctx, user);
      break;
      
    // ===== ЩОТИЖНЕВИЙ ЗВІТ =====
    case '📈 Щотижневий звіт':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Щотижневий звіт');
        return;
      }
      await typing(ctx, 2000);
      await generateWeeklyReport(ctx, tgId);
      break;
      
    // ===== ЩОМІСЯЧНИЙ ЗВІТ =====
    case '📈 Щомісячний звіт':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Щомісячний звіт');
        return;
      }
      await typing(ctx, 2000);
      await generateMonthlyReport(ctx, tgId);
      break;
      
    // ===== ДОПОМОГА =====
    case '❓ Допомога':
      await ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
      break;
      
    // ===== ЗВ'ЯЗОК =====
    case '📞 Зв\'язок з нами':
      await ctx.reply(MENU_TEXTS.CONTACT, keyboards.mainMenuKeyboard());
      break;
      
    // ===== ІНСТРУКЦІЇ =====
    case '📝 Інструкції':
      await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
      break;
      
    // ===== НЕВІДОМА КОМАНДА =====
    default:
      console.log(`[textHandler] ❓ Невідома команда: "${text}"`);
      await ctx.reply(
        '❓ Не розпізнав команду. Обери з меню нижче:',
        keyboards.mainMenuKeyboard()
      );
  }
};

// ===== БЛОКУВАННЯ ФУНКЦІЇ =====
const showFeatureBlocked = async (ctx, featureName) => {
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
};

// ===== ПРОГРЕС =====
const showProgress = async (ctx, user) => {
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
};

// ===== ЩОТИЖНЕВИЙ ЗВІТ =====
const generateWeeklyReport = async (ctx, tgId) => {
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
    console.error('[textHandler] Помилка звіту:', error);
    await ctx.reply('❌ Помилка генерації. Спробуй пізніше.');
  }
};

// ===== ЩОМІСЯЧНИЙ ЗВІТ =====
const generateMonthlyReport = async (ctx, tgId) => {
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
    console.error('[textHandler] Помилка звіту:', error);
    await ctx.reply('❌ Помилка генерації. Спробуй пізніше.');
  }
};

export default { handle };