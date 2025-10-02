// src/controllers/handlers/menuHandler.js - ОНОВЛЕНИЙ

import keyboards from '../../utils/keyboards.js';
import aiMentorController from '../flows/aiMentorController.js';
import wheelController from '../flows/wheelController.js';
import {
  MENU_BUTTONS,
  MENU_TEXTS,
  GENERAL_AFFIRMATIONS
} from '../../config/constants.js';

const handleCommand = async (ctx, user, text, hasAccess) => {
  console.log(`[menuHandler] Команда: "${text}", доступ: ${hasAccess}`);

  switch (text) {
    // ===== AI НАСТАВНИК =====
    case '🤖 AI Наставник':
    case MENU_BUTTONS.AI_MENTOR:
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'AI Наставник');
        return;
      }
      await aiMentorController.handleAIMentorRequest(ctx);
      break;

    // ===== КОЛЕСО БАЛАНСУ =====
    case '🎯 Колесо балансу':
    case MENU_BUTTONS.WHEEL:
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Колесо балансу');
        return;
      }
      await wheelController.handleRequest(ctx);
      break;

    // ===== ПІДПИСКА =====
    case '💰 Підписка':
    case MENU_BUTTONS.SUBSCRIPTION:
      await showSubscriptionInfo(ctx, user);
      break;

    // ===== СТАРІ КНОПКИ (зворотна сумісність) =====
    case MENU_BUTTONS.AFFIRMATION:
    case '💎 Афірмація':
      const affirmation = getRandomAffirmation();
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      break;

    case '📈 Щотижневий звіт':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Звіти');
        return;
      }
      await startWeeklyReport(ctx);
      break;

    case '📈 Щомісячний звіт':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Звіти');
        return;
      }
      await startMonthlyReport(ctx);
      break;

    case MENU_BUTTONS.PROGRESS:
    case '📈 Мій прогрес':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Прогрес');
        return;
      }
      await showProgress(ctx);
      break;

    case MENU_BUTTONS.INSTRUCTIONS:
    case '📝 Інструкції':
      await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
      break;

    case MENU_BUTTONS.CONTACT:
    case '📞 Зв\'язок з нами':
    case '📞 Зв\'язок':
      await ctx.reply(MENU_TEXTS.CONTACT, keyboards.mainMenuKeyboard());
      break;

    // ===== НЕВІДОМА КОМАНДА =====
    default:
      await ctx.reply(
        '❓ Не розпізнав команду. Скористайся головним меню внизу 👇',
        keyboards.mainMenuKeyboard()
      );
      break;
  }
};

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====

const showFeatureBlocked = async (ctx, featureName) => {
  await ctx.reply(
    `🚫 ${featureName} недоступний\n\n` +
    `Потрібна активна підписка.\n\n` +
    `💰 Натисни "Підписка" в меню для активації.`,
    keyboards.mainMenuKeyboard()
  );
};

const showSubscriptionInfo = async (ctx, user) => {
  const subscriptionController = (await import('../subscriptionController.js')).default;
  await subscriptionController.handleSubscriptionInfo(ctx);
};

const showProgress = async (ctx) => {
  const message = 
    `📊 ТВІЙ ПРОГРЕС\n\n` +
    `Статистика та досягнення.\n\n` +
    `Дані оновлюються після кожної сесії.\n\n` +
    `Використай кнопку "📊 Звіти та прогрес" для детальної інформації.`;

  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

const startWeeklyReport = async (ctx) => {
  const msg =
    `📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n` +
    `Генерую звіт за останній тиждень...\n\n` +
    `⏱ Зачекай хвилинку.`;
  
  await ctx.reply(msg);
  
  // Тут викликається генерація звіту
  const reportService = (await import('../../services/reportService.js')).default;
  const report = await reportService.generateReport(ctx.from.id, 7);
  
  await ctx.reply(
    `📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n${report}`,
    keyboards.mainMenuKeyboard()
  );
};

const startMonthlyReport = async (ctx) => {
  const msg =
    `📅 ЩОМІСЯЧНИЙ ЗВІТ\n\n` +
    `Генерую звіт за останній місяць...\n\n` +
    `⏱ Зачекай хвилинку.`;
  
  await ctx.reply(msg);
  
  // Тут викликається генерація звіту
  const reportService = (await import('../../services/reportService.js')).default;
  const report = await reportService.generateReport(ctx.from.id, 30);
  
  await ctx.reply(
    `📅 ЩОМІСЯЧНИЙ ЗВІТ\n\n${report}`,
    keyboards.mainMenuKeyboard()
  );
};

const getRandomAffirmation = () => {
  const i = Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length);
  return GENERAL_AFFIRMATIONS[i];
};

export default {
  handleCommand,
  showFeatureBlocked,
  showSubscriptionInfo,
  showProgress,
  startWeeklyReport,
  startMonthlyReport
};