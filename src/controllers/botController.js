// src/controllers/botController.js
import userService from '../services/userService.js';
import keyboards from '../utils/keyboards.js';
import affirmationService from '../services/affirmationService.js';
import responseService from '../services/responseService.js';
import analyticsController from './analyticsController.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS, ANSWER_STEPS, SCHEDULE, QUESTION_TYPES, LATE_TEXT } from '../config/constants.js';
import { getBase } from '../config/database.js';

// Ініціалізація бота
export default function botController(bot) {
  bot.catch((err, ctx) => {
    console.error('[botController] Помилка:', err);
    bot.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    setTimeout(() => ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard()), 1500);
  });

  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    let user = await userService.getUserByTelegramId(tgId);
    await bot.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    if (!user) {
      ctx.session = ctx.session || {};
      ctx.session.step = 'reg_name';
      ctx.session.temp = {};
      return ctx.reply(`🌟 Вітаю в AI-Coach! Як тебе звати?`, keyboards.skipKeyboard());
    }
    return ctx.reply(profileMessage(user), keyboards.mainMenuKeyboard());
  });

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    console.log(`[botController] Отримано повідомлення: "${text}" від користувача ${tgId}`);
    ctx.session = ctx.session || {};
    await bot.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));

    // Реєстрація
    if (ctx.session.step === 'reg_name') {
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.name = text.trim();
      ctx.session.step = 'reg_email';
      return ctx.reply('Вкажи свій email або натисни «Пропустити»:', keyboards.skipKeyboard());
    }
    if (ctx.session.step === 'reg_email') {
      ctx.session.temp.email = text.trim();
      ctx.session.step = 'reg_phone';
      return ctx.reply('Вкажи номер у форматі +380XXXXXXXXX або натисни «Пропустити»:', keyboards.skipKeyboard());
    }
    if (ctx.session.step === 'reg_phone') {
      const newUser = await userService.createUser({ tgId, name: ctx.session.temp.name });
      ctx.session.step = null;
      ctx.session.temp = {};
      return ctx.reply(profileMessage(newUser), keyboards.mainMenuKeyboard());
    }

    // Обробка відповідей на питання
    if (user && user.Answer_Step && user.Answer_Step !== ANSWER_STEPS.COMPLETED) {
      const isValidTime = isValidResponseTime(user.Answer_Step);
      if (!isValidTime) {
        const nextType = user.Answer_Step.startsWith('Q_m_') || user.Answer_Step === ANSWER_STEPS.MORNING_PENDING ? QUESTION_TYPES.EVENING : QUESTION_TYPES.MORNING;
        return ctx.reply(LATE_TEXT(nextType), keyboards.mainMenuKeyboard());
      }
      return await handleQuestionAnswer(ctx, user, text);
    }

    // ✅ Нова логіка меню
    if (text === '📊 Щотижневий звіт') {
      console.log(`[botController] Запит щотижневого звіту для ${tgId}`);
      return await analyticsController.generateWeeklyReport(ctx);
    }
    if (text === '📈 Щомісячний звіт') {
      console.log(`[botController] Запит щомісячного звіту для ${tgId}`);
      return await analyticsController.generateMonthlyReport(ctx);
    }
    if (text === '💎 Афірмація') {
      console.log(`[botController] Отримання афірмації для ${tgId}`);
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`🌀 Афірмація:\n\n${aff}`, keyboards.mainMenuKeyboard());
    }
    if (text === '📊  Мій прогрес') {
      console.log(`[botController] Показ прогресу для ${tgId}`);
      return await showUserProgress(ctx, user);
    }
    if (text === '💰 Підписка') {
      console.log(`[botController] Показ підписки для ${tgId}`);
      return await showSubscriptionInfo(ctx, user);
    }
    if (text === '❓ Допомога') {
      const helpText = `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`;
      return ctx.reply(helpText, keyboards.mainMenuKeyboard());
    }
    if (text === '📞 Зв\'язок з нами') {
      const contactText = `📞 ЗВ\'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`;
      return ctx.reply(contactText, keyboards.supportKeyboard());
    }
    if (text === '📝 Інструкції') {
      const instructionsText = `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📊 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📊  Мій прогрес" — статистика\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• 08:00 — ранкові питання (6 запитань)\n• 20:30 — вечірні питання (5 запитань)\n\n💡 **ПОРАДИ:**\n• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв\'язок з нами" при проблемах`;
      return ctx.reply(instructionsText, keyboards.mainMenuKeyboard());
    }
    if (['+', 'ок', 'ok', 'добре', 'так'].includes(text.toLowerCase())) {
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`💝 Швидка підтримка!\n\n${aff}`, keyboards.mainMenuKeyboard());
    }
    return ctx.reply('Оберіть пункт з меню:', keyboards.mainMenuKeyboard());
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await bot.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    if (data === 'main_menu') {
      await ctx.reply('🏠 Головне меню', keyboards.mainMenuKeyboard());
      return ctx.answerCbQuery();
    }
    await ctx.answerCbQuery();
  });
}

// Решта функцій залишається без змін...
// (тут би весь код з оригінального файлу - isValidResponseTime, startMorningQuestions, etc.)

// Перевірка часового вікна
function isValidResponseTime(answerStep) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const morningStart = SCHEDULE.MORNING_START * 60;
  const morningEnd = SCHEDULE.MORNING_END * 60;
  const eveningStart = SCHEDULE.EVENING_START * 60;
  const eveningEnd = SCHEDULE.EVENING_END * 60;
  const isMorningTime = timeInMinutes >= morningStart && timeInMinutes <= morningEnd;
  const isEveningTime = timeInMinutes >= eveningStart || timeInMinutes <= eveningEnd;

  console.log(`[isValidResponseTime] Час: ${hours}:${minutes}, Answer_Step: ${answerStep}, isMorningTime: ${isMorningTime}, isEveningTime: ${isEveningTime}`);

  if (answerStep.startsWith('Q_m_') || answerStep === ANSWER_STEPS.MORNING_PENDING) {
    const isValid = isMorningTime;
    console.log(`[isValidResponseTime] Morning check: ${isValid}`);
    return isValid;
  }
  if (answerStep.startsWith('Q_e_') || answerStep === ANSWER_STEPS.EVENING_PENDING) {
    const isValid = isEveningTime;
    console.log(`[isValidResponseTime] Evening check: ${isValid}`);
    return isValid;
  }
  console.log(`[isValidResponseTime] Невідомий Answer_Step: ${answerStep}`);
  return false;
}

// Показ підписки
async function showSubscriptionInfo(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }
  const name = user['User Name'] || 'Користувач';
  const active = user['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user['Active Subscription Plan'] || '—';
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';
  const subscriptionText = `📦 ПІДПИСКА:\n\n${active.includes('✅') ? `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}` : '❌ Неактивна'}\n\n📝 Реєстраційні дані: ✅ Заповнені`;
  await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
  await new Promise((res) => setTimeout(res, 1500));
  return ctx.reply(subscriptionText, keyboards.mainMenuKeyboard());
}

// Показ прогресу
async function showUserProgress(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }
  try {
    const tgId = ctx.from.id;
    
    const records = await responseService.getUserRecords(tgId, 30);
    
    let totalDays = records.length;
    let morningCompleted = 0;
    let eveningCompleted = 0;
    
    records.forEach(record => {
      if (record.fields.End_m) morningCompleted++;
      if (record.fields.End_e) eveningCompleted++;
    });
    
    const progressText = `📋 ВАШ ПРОГРЕС (за 30 днів):\n\n📝 Всього днів: ${totalDays}\n🌅 Ранкові: ${morningCompleted}\n🌙 Вечірні: ${eveningCompleted}\n\n💡 Для детального аналізу використовуй кнопки "📊 Щотижневий звіт" і "📈 Щомісячний звіт"`;
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply(progressText, keyboards.mainMenuKeyboard());
  } catch (error) {
    console.error('[showUserProgress] Помилка:', error);
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('📊 Прогрес тимчасово недоступний', keyboards.mainMenuKeyboard());
  }
}

// ✅ ГОЛОВНА ФУНКЦІЯ - Обробка відповідей на питання
async function handleQuestionAnswer(ctx, user, answer) {
  const tgId = ctx.from.id;
  const currentStep = user.Answer_Step;
  const userName = user['User Name'] || 'Користувач';
  console.log(`[handleQuestionAnswer] Користувач ${tgId}, Крок: ${currentStep}`);

  let questionType, questions, questionNumber, nextStep, fieldName;

  // Визначаємо тип питань і наступний крок
  if (currentStep.startsWith('Q_m_')) {
    questionType = QUESTION_TYPES.MORNING;
    questions = MORNING_QUESTIONS;
    questionNumber = parseInt(currentStep.split('_')[2]);
    fieldName = `Q_m_${questionNumber}`;
    nextStep = questionNumber < 6 ? `Q_m_${questionNumber + 1}` : ANSWER_STEPS.END_MORNING;
  } else if (currentStep.startsWith('Q_e_')) {
    questionType = QUESTION_TYPES.EVENING;
    questions = EVENING_QUESTIONS;
    questionNumber = parseInt(currentStep.split('_')[2]);
    fieldName = `Q_e_${questionNumber}`;
    nextStep = questionNumber < 5 ? `Q_e_${questionNumber + 1}` : ANSWER_STEPS.END_EVENING;
  } else {
    console.log('[handleQuestionAnswer] Невідомий крок:', currentStep);
    await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Щось пішло не так. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }

  try {
    // ✅ Зберігаємо відповідь В ОДИН ЗАПИС
    await responseService.createOrUpdateResponse(tgId, userName, questionType, currentStep, questionNumber, answer, fieldName);
    console.log(`[handleQuestionAnswer] ✅ Збережено відповідь для ${questionType} Q${questionNumber}`);

    // Перевіряємо, чи це останнє питання
    if (nextStep === ANSWER_STEPS.END_MORNING || nextStep === ANSWER_STEPS.END_EVENING) {
      // Отримуємо афірмацію
      const affirmation = await affirmationService.getAffirmationAndMarkUsed(questionType.toLowerCase());
      
      // ✅ Зберігаємо афірмацію В ТОЙ ЖЕ ЗАПИС
      const affirmationField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
      await responseService.createOrUpdateResponse(tgId, userName, questionType, nextStep, 0, affirmation, affirmationField, true);
      
      console.log(`[handleQuestionAnswer] ✅ Збережено афірмацію для ${questionType}`);
      
      // Встановлюємо статус завершено
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

      const endMessage = questionType === QUESTION_TYPES.MORNING
        ? `✅ Ранкові питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`
        : `✅ Вечірні питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`;
      
      await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
      await new Promise((res) => setTimeout(res, 1500));
      return ctx.reply(endMessage, keyboards.mainMenuKeyboard());
    }

    // Переходимо до наступного питання
    await userService.updateUserStep(tgId, nextStep);
    const nextQuestionIndex = questionNumber;
    const nextQuestion = questions[nextQuestionIndex];
    
    await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply(`${questionNumber + 1}️⃣/${questions.length} ${nextQuestion}`);
    
  } catch (error) {
    console.error('[handleQuestionAnswer] ❌ Помилка:', error);
    await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Помилка при збереженні відповіді. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
}

// Формування профілю
function profileMessage(user) {
  const name = user['User Name'] || 'Користувач';
  const tg = user['TG_id'] || '—';
  const active = user['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user['Active Subscription Plan'] || '—';
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';
  return `📊 ПРОФІЛЬ\n\n👤 Ім'я: ${name}\n🆔 ID: ${tg}\n\n📦 ПІДПИСКА:\n${active.includes('✅') ? `${active}\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}` : '❌ Неактивна'}`;
}