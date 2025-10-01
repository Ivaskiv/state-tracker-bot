// src/controllers/handlers/menuHandler.js — меню без інлайн-кнопок, усе через головне меню

import keyboards from '../../utils/keyboards.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
// ВАЖЛИВО: беремо актуальний контролер колеса з flows/, а не старий wheelBalanceController
import wheelController from '../flows/wheelController.js';

import {
  MENU_BUTTONS,
  MENU_TEXTS,
  GENERAL_AFFIRMATIONS,
  MESSAGES
} from '../../config/constants.js';

const handleCommand = async (ctx, user, text, hasAccess) => {
  console.log(`[menuHandler] Команда: "${text}", доступ: ${hasAccess}`);

  switch (text) {
    // ===== AI НАСТАВНИК =====
    case MENU_BUTTONS.AI_MENTOR: {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'AI наставник');
        return;
      }
      await aiMentorController.handleAIMentorRequest(ctx);
      break;
    }

    // ===== КОЛЕСО БАЛАНСУ =====
    case MENU_BUTTONS.WHEEL: {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Колесо балансу');
        return;
      }
      await wheelController.handleRequest(ctx);
      break;
    }

    // ===== ПІДПИСКА =====
    case MENU_BUTTONS.SUBSCRIPTION: {
      await showSubscriptionInfo(ctx, user);
      break;
    }

    // ===== АФІРМАЦІЯ =====
    case MENU_BUTTONS.AFFIRMATION: {
      const affirmation = getRandomAffirmation();
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      break;
    }

    // ===== МІЙ ПРОГРЕС =====
    case MENU_BUTTONS.PROGRESS: {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Прогрес');
        return;
      }
      await showProgress(ctx);
      break;
    }

    // ===== ЩОТИЖНЕВИЙ ЗВІТ =====
    case MENU_BUTTONS.WEEKLY_REPORT: {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Щотижневий звіт');
        return;
      }
      await startWeeklyReport(ctx);
      break;
    }

    // ===== ЩОМІСЯЧНИЙ ЗВІТ =====
    case MENU_BUTTONS.MONTHLY_REPORT: {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Щомісячний звіт');
        return;
      }
      await startMonthlyReport(ctx);
      break;
    }

    // ===== ДОПОМОГА =====
    case MENU_BUTTONS.INSTRUCTIONS: {
      await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
      break;
    }

    // ===== ЗВʼЯЗОК =====
    case MENU_BUTTONS.CONTACT: {
      await ctx.reply(MENU_TEXTS.CONTACT, keyboards.mainMenuKeyboard());
      break;
    }

    // ===== НЕВІДОМА КОМАНДА =====
    default: {
      await ctx.reply('❓ Не розпізнав команду. Скористайся головним меню внизу.', keyboards.mainMenuKeyboard());
      break;
    }
  }
};

// ===== Повідомлення про заблоковану функцію (без інлайн-кнопок) =====
const showFeatureBlocked = async (ctx, featureName) => {
  await ctx.reply(
    MESSAGES.FEATURE_BLOCKED(featureName, MENU_BUTTONS.SUBSCRIPTION),
    keyboards.mainMenuKeyboard()
  );
};

// ===== Підписка (лише інформування, дія — через головне меню) =====
const showSubscriptionInfo = async (ctx, user) => {
  const status = user?.['Active_Subscription_Status'] || '❌ Неактивна';
  await ctx.reply(
    `💰 ПІДПИСКА\n\nСтатус: ${status}\n\nВикористай пункт «${MENU_BUTTONS.SUBSCRIPTION}» у нижньому меню для деталей та оновлення.`,
    keyboards.mainMenuKeyboard()
  );
};

// ===== Прогрес (без інлайн-кнопок) =====
const showProgress = async (ctx) => {
  await ctx.reply(
    `📊 ПРОГРЕС\n\nСтатистика оновлюється після кожної сесії.\nКористуйся розділами з головного меню внизу.`,
    keyboards.mainMenuKeyboard()
  );
};

// ===== Щотижневий звіт =====
const startWeeklyReport = async (ctx) => {
  const msg =
    `📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n` +
    `Час проаналізувати тиждень і скоригувати стратегію.\n` +
    `Використай головне меню для подальших дій.`;
  await ctx.reply(msg, keyboards.mainMenuKeyboard());
};

// ===== Щомісячний звіт =====
const startMonthlyReport = async (ctx) => {
  const msg =
    `📅 ЩОМІСЯЧНИЙ ЗВІТ\n\n` +
    `Глибокий аналіз місяця та «Колесо балансу».\n` +
    `Використай головне меню для подальших дій.`;
  await ctx.reply(msg, keyboards.mainMenuKeyboard());
};

// ===== Випадкова афірмація зі сховища констант =====
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
