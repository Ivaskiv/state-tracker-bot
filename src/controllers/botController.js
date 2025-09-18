// src/controllers/botController.js - ПОВНИЙ ФАЙЛ З ДІАГНОСТИЧНОЮ КОМАНДОЮ

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import { cancelPendingReminders } from '../middleware/pendingFlow.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { handleStart, handleRegistrationStep } from '../auth/modules/auth.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';
import subscriptionController from './subscriptionController.js';

const WHEEL_STEP = 'WheelBalance';

const isActiveQuestionsStep = (step) => Boolean(step && (step.startsWith('Q_m_') || step.startsWith('Q_e_')));
const isActiveAIStep = (step) => Boolean(step && (step === 'AI_ACTIVE' || step?.startsWith('AI_')));

const botController = (bot) => {
  logger.info('[botController] Initializing bot controller...');

  // ✅ ВИДАЛЕНО bot.use(session()) - вже додано в server.js
  bot.use(globalTypingMiddleware());

  bot.start(async (ctx) => {
    await handleStart(ctx);
  });

  bot.command('menu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');

      if (ctx.session) {
        ctx.session.step = undefined;
        ctx.session.temp = {};
      }

      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      cancelPendingReminders(ctx.from.id);

      await ctx.reply('🔄 Оновлення меню...', keyboards.removeKeyboard());
      await new Promise((r) => setTimeout(r, 500));
      await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.command('updatemenu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');

      if (ctx.session) {
        ctx.session.step = undefined;
        ctx.session.temp = {};
      }

      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      cancelPendingReminders(ctx.from.id);

      await ctx.reply('🔄 Оновлюємо меню...', keyboards.removeKeyboard());
      await new Promise((r) => setTimeout(r, 1000));
      await ctx.reply('✅ Меню оновлено!', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await ctx.reply('❌ Помилка оновлення');
    }
  });

  // ✅ ДІАГНОСТИЧНА КОМАНДА
  bot.command('checkuser', async (ctx) => {
    const tgId = ctx.from.id;
    
    try {
      console.log(`[DIAGNOSTIC] 🔍 Перевірка користувача ${tgId}`);
      
      const user = await userService.getUserByTelegramId(tgId);
      
      if (user) {
        const diagnosticInfo = {
          'TG_id': user['TG_id'],
          'User Name': user['User Name'],
          'Email': user['Email'] || 'не вказано',
          'Phone': user['Phone'] || 'не вказано',
          'Active_Subscription_Status': user['Active_Subscription_Status'] || 'немає статусу',
          'Active Subscription Plan': user['Active Subscription Plan'] || 'немає плану',
          'Answer_Step': user['Answer_Step'] || 'немає кроку',
          'Start_Date': user['Start_Date'] || 'немає дати початку',
          'End_Date': user['End_Date'] || 'немає дати закінчення',
          'Last Modified Time': user['Last Modified Time'] || 'невідомо'
        };
        
        console.log(`[DIAGNOSTIC] ✅ Користувач знайдений:`, diagnosticInfo);
        
        const message = `🔍 ДІАГНОСТИКА КОРИСТУВАЧА\n\n` +
          `👤 TG_id: ${diagnosticInfo['TG_id']}\n` +
          `📝 Ім'я: ${diagnosticInfo['User Name']}\n` +
          `📧 Email: ${diagnosticInfo['Email']}\n` +
          `📱 Phone: ${diagnosticInfo['Phone']}\n` +
          `💰 Статус підписки: ${diagnosticInfo['Active_Subscription_Status']}\n` +
          `📋 План підписки: ${diagnosticInfo['Active Subscription Plan']}\n` +
          `⚙️ Крок: ${diagnosticInfo['Answer_Step']}\n` +
          `📅 Початок: ${diagnosticInfo['Start_Date']}\n` +
          `📅 Кінець: ${diagnosticInfo['End_Date']}\n` +
          `🕐 Останні зміни: ${diagnosticInfo['Last Modified Time']}`;
        
        await ctx.reply(message);
        
        // Перевірка активності підписки
        const hasActive = user['Active_Subscription_Status']?.includes('✅ Активна');
        await ctx.reply(`🔍 АКТИВНІСТЬ ПІДПИСКИ: ${hasActive ? '✅ АКТИВНА' : '❌ НЕАКТИВНА'}`);
        
      } else {
        console.log(`[DIAGNOSTIC] ❌ Користувача ${tgId} НЕ ЗНАЙДЕНО в базі`);
        await ctx.reply(`❌ КОРИСТУВАЧА НЕ ЗНАЙДЕНО\n\nTG_id: ${tgId}\nМожете пройти реєстрацію командою /start`);
      }
      
    } catch (error) {
      console.error('[DIAGNOSTIC] Помилка:', error);
      await ctx.reply(`❌ Помилка діагностики: ${error.message}`);
    }
  });

  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) {
        logger.info(`[botController] ✅ Оброблено крок реєстрації для ${tgId}`);
        return;
      }

      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        logger.warn(`[botController] ❌ Користувача ${tgId} не знайдено після реєстрації`);
        return ctx.reply('Натисніть /start', keyboards.mainMenuKeyboard());
      }

      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = ['💰 Підписка', '📞 Зв\'язок з нами', '❓ Допомога'];
      if (!subscriptionStatus.active && !allowedForInactive.includes(text)) {
        await ctx.reply(
          '❌ Твоя підписка закінчилася.\n\nЩоб користуватися всіма функціями бота, оформи або продовжи підписку.\n\n📞 Зв\'яжіся з підтримкою: nadyastarway@gmail.com',
          keyboards.subscriptionKeyboard()
        );
        return;
      }

      const step = user.Answer_Step;
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveQA = isActiveQuestionsStep(step);
      const isActiveAI = isActiveAIStep(step);

      if (isActiveAI) {
        if (text.includes('вихід') || text === '🚪 Вийти із сесії') {
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          cancelPendingReminders(tgId);
          await completeSession(tgId, ctx, '👋 Повертаємося до меню.');
          return;
        }

        if (text === '💎 Афірмація') {
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          cancelPendingReminders(tgId);
          await handleMenuCommands(ctx, user, text, bot);
          return;
        }

        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      if (isActiveWheel) {
        const score = parseInt(text, 10);
        if (!Number.isNaN(score) && score >= 0 && score <= 10) {
          await wheelBalanceController.handleWheelBalanceAnswer(ctx, score);
        } else {
          await ctx.reply('❌ Введи число від 0 до 10 або використай кнопки:', keyboards.wheelScoreInlineKeyboard());
        }
        return;
      }

      if (isActiveQA) {
        const answered = await handleQuestionAnswer(ctx, user, text);
        if (answered) return;
      }

      await handleMenuCommands(ctx, user, text, bot);
    } catch (error) {
      await handleError(ctx, error);
    }
  });
// ✅ Команда для перевірки поточного користувача
bot.command('whoami', async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name;
  const username = ctx.from.username;
  
  try {
    console.log(`[DIAGNOSTIC] 🔍 Команда /whoami від користувача ${tgId}`);
    
    // Перевіряємо в базі
    const user = await userService.getUserByTelegramId(tgId);
    
    let message = `🔍 ТВОЯ ІНФОРМАЦІЯ\n\n`;
    message += `📱 Telegram ID: ${tgId}\n`;
    message += `👤 Ім'я: ${name}\n`;
    message += `🔗 Username: @${username || 'немає'}\n\n`;
    
    if (user) {
      message += `✅ СТАТУС: Зареєстрований\n`;
      message += `📝 Ім'я в базі: ${user['User Name']}\n`;
      message += `📧 Email: ${user['Email'] || 'не вказано'}\n`;
      message += `📱 Телефон: ${user['Phone'] || 'не вказано'}\n`;
      message += `💰 Підписка: ${user['Active_Subscription_Status'] || 'невідомо'}\n`;
      message += `📋 План: ${user['Active Subscription Plan'] || 'невідомо'}\n`;
    } else {
      message += `❌ СТАТУС: НЕ зареєстрований\n\n`;
      message += `💡 Натисни /start для реєстрації`;
    }
    
    await ctx.reply(message);
    
  } catch (error) {
    console.error('[DIAGNOSTIC] Помилка /whoami:', error);
    await ctx.reply(`❌ Помилка діагностики: ${error.message}`);
  }
});

// ✅ Команда для перегляду всіх користувачів (тільки для dev)
bot.command('allusers', async (ctx) => {
  if (process.env.NODE_ENV === 'production') {
    return ctx.reply('❌ Команда доступна тільки в режимі розробки');
  }
  
  try {
    console.log(`[DIAGNOSTIC] 🔍 Команда /allusers від ${ctx.from.id}`);
    
    const base = getBase();
    const records = await base('Users').select({
      maxRecords: 10,
      fields: ['TG_id', 'User Name', 'Email', 'Active_Subscription_Status'],
      sort: [{ field: 'TG_id', direction: 'desc' }]
    }).firstPage();
    
    let message = `👥 КОРИСТУВАЧІ В БАЗІ (${records.length}):\n\n`;
    
    records.forEach((record, i) => {
      const fields = record.fields;
      message += `${i + 1}. ${fields['User Name'] || 'Без імені'}\n`;
      message += `   📱 ID: ${fields.TG_id}\n`;
      message += `   📧 Email: ${fields.Email || 'немає'}\n`;
      message += `   💰 Підписка: ${fields['Active_Subscription_Status'] || 'немає'}\n\n`;
    });
    
    if (records.length === 0) {
      message += `Користувачів не знайдено.\n\nПеревірте підключення до Airtable.`;
    }
    
    await ctx.reply(message);
    
  } catch (error) {
    console.error('[DIAGNOSTIC] Помилка /allusers:', error);
    await ctx.reply(`❌ Помилка: ${error.message}`);
  }
});

// ✅ Команда для тестування підключення до Airtable
bot.command('testdb', async (ctx) => {
  if (process.env.NODE_ENV === 'production') {
    return ctx.reply('❌ Команда доступна тільки в режимі розробки');
  }
  
  try {
    console.log(`[DIAGNOSTIC] 🔍 Команда /testdb від ${ctx.from.id}`);
    
    const base = getBase();
    
    // Тестуємо підключення
    const testRecord = await base('Users').select({
      maxRecords: 1,
      fields: ['TG_id']
    }).firstPage();
    
    let message = `🔗 ТЕСТ ПІДКЛЮЧЕННЯ ДО AIRTABLE\n\n`;
    message += `✅ Підключення: OK\n`;
    message += `📊 Знайдено записів: ${testRecord.length}\n`;
    
    if (testRecord.length > 0) {
      message += `📱 Перший TG_id: ${testRecord[0].fields.TG_id}\n`;
    }
    
    // Інформація про конфігурацію
    message += `\n🔧 КОНФІГУРАЦІЯ:\n`;
    message += `- API Key: ${process.env.AIRTABLE_API_KEY ? 'встановлено' : '❌ НЕ встановлено'}\n`;
    message += `- Base ID: ${process.env.AIRTABLE_BASE_ID ? 'встановлено' : '❌ НЕ встановлено'}\n`;
    
    await ctx.reply(message);
    
  } catch (error) {
    console.error('[DIAGNOSTIC] Помилка /testdb:', error);
    await ctx.reply(`❌ Помилка підключення до Airtable:\n${error.message}`);
  }
});

// ✅ Команда для форсованого видалення користувача (тільки для dev)
bot.command('deleteuser', async (ctx) => {
  if (process.env.NODE_ENV === 'production') {
    return ctx.reply('❌ Команда доступна тільки в режимі розробки');
  }
  
  const tgId = ctx.from.id;
  
  try {
    console.log(`[DIAGNOSTIC] 🗑️ Команда /deleteuser від ${tgId}`);
    
    const base = getBase();
    const records = await base('Users').select({
      filterByFormula: `{TG_id} = "${tgId}"`,
      maxRecords: 1
    }).firstPage();
    
    if (records.length === 0) {
      await ctx.reply('❌ Твого запису не знайдено в базі');
      return;
    }
    
    await base('Users').destroy([records[0].id]);
    await ctx.reply('✅ Твій запис видалено з бази.\n\nТепер можеш пройти реєстрацію заново командою /start');
    
    console.log(`[DIAGNOSTIC] ✅ Користувача ${tgId} видалено з бази`);
    
  } catch (error) {
    console.error('[DIAGNOSTIC] Помилка /deleteuser:', error);
    await ctx.reply(`❌ Помилка видалення: ${error.message}`);
  }
});
bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    
    // ВАЖЛИВО: Перевірити чи існує користувач
    const existingUser = await db.query(
        'SELECT * FROM Users WHERE telegram_id = ?', 
        [userId]
    );
    
    if (existingUser.length === 0) {
        // Додати користувача в таблицю Users
        await db.query(`
            INSERT INTO Users (telegram_id, username, first_name, created_at, is_active) 
            VALUES (?, ?, ?, NOW(), 1)
        `, [userId, username, firstName]);
        
        console.log(`✅ Користувач ${userId} доданий в таблицю Users`);
    }
});
console.log('[botController] ✅ Діагностичні команди додано: /whoami, /allusers, /testdb, /deleteuser');
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    try {
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = [
        'subscription_info', 'contact_support', 'subscription_plans',
        'subscribe_week', 'subscribe_month', 'subscribe_year', 'sync_subscription'
      ];

      if (!subscriptionStatus.active && !allowedForInactive.includes(data)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      if (data === 'continue_answers' || data === 'skip_session') {
        const user = await userService.getUserByTelegramId(tgId);
        const step = user?.Answer_Step || '';

        if (data === 'continue_answers') {
          if (step.startsWith('Q_m_')) {
            const questionNum = parseInt(step.split('_')[2], 10);
            const currentQuestion = `${questionNum}️⃣/6 ${MORNING_QUESTIONS[questionNum - 1]}`;
            await ctx.editMessageText(`🌞 РАНКОВІ ПИТАННЯ\n\n${currentQuestion}`);
          } else if (step.startsWith('Q_e_')) {
            const questionNum = parseInt(step.split('_')[2], 10);
            const currentQuestion = `${questionNum}️⃣/5 ${EVENING_QUESTIONS[questionNum - 1]}`;
            await ctx.editMessageText(`🌙 ВЕЧІРНІ ПИТАННЯ\n\n${currentQuestion}`);
          } else if (step === WHEEL_STEP) {
            await ctx.editMessageText('🎯 Продовжуємо колесо балансу...');
            await wheelBalanceController.handleWheelBalanceRequest(ctx);
          } else if (isActiveAIStep(step)) {
            await ctx.editMessageText('🤖 AI-наставник активний. Задавай питання!');
          } else {
            await ctx.editMessageText('Немає активних сесій');
          }
          await ctx.answerCbQuery('Продовжуємо');
          return;
        }

        await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
        cancelPendingReminders(tgId);

        await ctx.editMessageText('🚪 Сесію завершено. Повертаємося до меню.');
        await ctx.answerCbQuery('Сесію завершено');
        await new Promise((r) => setTimeout(r, 800));
        await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
        return;
      }

      if (['restart_morning', 'restart_evening', 'cancel_restart'].includes(data)) {
        await handleRestartCallback(ctx);
        return;
      }

      if (['ai_continue', 'ai_exit'].includes(data)) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (
        data.startsWith('wheel_score_') ||
        data === 'wheel_exit' ||
        data === 'wheel_retry' ||
        data === 'wheel_start_new' ||
        data === 'wheel_to_menu'
      ) {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      if (
        [
          'subscription_info',
          'subscription_plans',
          'subscribe_week',
          'subscribe_month',
          'subscribe_year',
          'renew_subscription',
          'sync_subscription',
          'contact_support'
        ].includes(data)
      ) {
        await subscriptionController.handleCallback(ctx);
        return;
      }

      await ctx.answerCbQuery('Команда не розпізнана');
    } catch (error) {
      await handleError(ctx, error);
      try { await ctx.answerCbQuery('Помилка обробки'); } catch {}
    }
  });

  return { bot };
};

export default botController;