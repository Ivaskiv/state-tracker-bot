// src/controllers/botController.js
// src/controllers/botController.js
import userService from '../services/userService.js';
import keyboards from '../utils/keyboards.js';
import affirmationService from '../services/affirmationService.js';
import responseService from '../services/responseService.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS, ANSWER_STEPS, SCHEDULE, QUESTION_TYPES } from '../config/constants.js';
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

    // Меню
    if (text === '📝 Ранкові питання') {
      console.log(`[botController] Початок ранкових питань для ${tgId}`);
      return await startMorningQuestions(ctx, user);
    }
    if (text === '🌙 Вечірні питання') {
      console.log(`[botController] Початок вечірніх питань для ${tgId}`);
      return await startEveningQuestions(ctx, user);
    }
    if (text === '💎 Афірмація') {
      console.log(`[botController] Отримання афірмації для ${tgId}`);
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`🌀 Афірмація:\n\n${aff}`, keyboards.mainMenuKeyboard());
    }
    if (text === '📊 Мій прогрес') {
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
    if (text === '📋 Інструкції') {
      const instructionsText = `📋 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📝 **ЩОДЕННІ ПРАКТИКИ:**\n• "📝 Ранкові питання" (8:00-20:00)\n• "🌙 Вечірні питання" (20:30-8:00)\n• "💎 Афірмація" — щоденна фраза\n\n📊 **ПРОГРЕС:**\n• "📊 Мій прогрес" — статистика\n\n🎯 **21-ДЕННИЙ МАРАФОН:**\n• Відео → аудіо → PDF → завдання\n\n💡 **ПОРАДИ:**\n• Відповідай щиро\n• Пиши в "📞 Зв\'язок з нами" при проблемах`;
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

// Перевірка часового вікна
function isValidResponseTime(answerStep) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const morningStart = SCHEDULE.MORNING_START * 60; // 8:00
  const morningEnd = SCHEDULE.MORNING_END * 60; // 20:00
  const eveningStart = SCHEDULE.EVENING_START * 60; // 20:30
  const eveningEnd = SCHEDULE.EVENING_END * 60; // 8:00 наступного дня
  const isNextDay = timeInMinutes < eveningEnd; // Після півночі
  if (answerStep.startsWith('Q_m_') || answerStep === ANSWER_STEPS.MORNING_PENDING) {
    return timeInMinutes >= morningStart && timeInMinutes <= morningEnd && !isNextDay;
  }
  if (answerStep.startsWith('Q_e_') || answerStep === ANSWER_STEPS.EVENING_PENDING) {
    return (timeInMinutes >= eveningStart || isNextDay) && (timeInMinutes <= eveningEnd || !isNextDay);
  }
  return false;
}

// Початок ранкових питань
async function startMorningQuestions(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }
  const isMorningCompleted = await responseService.isSessionCompleted(user.TG_id, QUESTION_TYPES.MORNING);
  if (isMorningCompleted) {
    return ctx.reply('🌞 Ви вже відповіли на ранкові питання сьогодні.', keyboards.mainMenuKeyboard());
  }
  const isValidTime = isValidResponseTime(ANSWER_STEPS.MORNING_PENDING);
  if (!isValidTime) {
    return ctx.reply('⏰ Ранкові питання доступні з 8:00 до 20:00.', keyboards.mainMenuKeyboard());
  }
  const tgId = ctx.from.id;
  await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_PENDING);
  await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
  await new Promise((res) => setTimeout(res, 1500));
  await ctx.reply(`🌞 Ранкові питання для фокусу та активації!\nВідповідай щиро ✨\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
}

// Початок вечірніх питань
async function startEveningQuestions(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }
  const isEveningCompleted = await responseService.isSessionCompleted(user.TG_id, QUESTION_TYPES.EVENING);
  if (isEveningCompleted) {
    return ctx.reply('🌙 Ви вже відповіли на вечірні питання сьогодні.', keyboards.mainMenuKeyboard());
  }
  const isValidTime = isValidResponseTime(ANSWER_STEPS.EVENING_PENDING);
  if (!isValidTime) {
    return ctx.reply('⏰ Вечірні питання доступні з 20:30 до 8:00.', keyboards.mainMenuKeyboard());
  }
  const tgId = ctx.from.id;
  await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
  await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
  await new Promise((res) => setTimeout(res, 1500));
  await ctx.reply(`🌙 Вечірні питання для аналізу дня!\nЧас підсумувати та зафіксувати перемоги 🏆\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
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
    const base = getBase();
    const tgId = ctx.from.id;
    const responses = await base('Responses').select({ filterByFormula: `{TG_id} = "${tgId}"` }).all();
    let totalResponses = responses.length;
    let morningResponses = responses.filter((r) => r.fields['morning_completed']).length;
    let eveningResponses = responses.filter((r) => r.fields['evening_completed']).length;
    const progressText = `📊 ВАШ ПРОГРЕС:\n\n📝 Всього днів: ${totalResponses}\n🌅 Ранкові: ${morningResponses}\n🌙 Вечірні: ${eveningResponses}\n\n💡 Пропозиція: відповідай щодня для розвитку!`;
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

// Обробка відповідей
async function handleQuestionAnswer(ctx, user, answer) {
  const tgId = ctx.from.id;
  const currentStep = user.Answer_Step;
  const userName = user['User Name'] || 'Користувач';
  console.log(`[handleQuestionAnswer] Користувач ${tgId}, Крок: ${currentStep}`);
  let questionType, questions, questionNumber, nextStep, fieldName;
  if (currentStep.startsWith('Q_m_') || currentStep === ANSWER_STEPS.MORNING_PENDING) {
    questionType = QUESTION_TYPES.MORNING;
    questions = MORNING_QUESTIONS;
    questionNumber = currentStep === ANSWER_STEPS.MORNING_PENDING ? 1 : parseInt(currentStep.split('_')[2]);
    fieldName = `Q_m_${questionNumber}`;
    nextStep = questionNumber < MORNING_QUESTIONS.length ? `Q_m_${questionNumber + 1}` : ANSWER_STEPS.COMPLETED;
  } else if (currentStep.startsWith('Q_e_') || currentStep === ANSWER_STEPS.EVENING_PENDING) {
    questionType = QUESTION_TYPES.EVENING;
    questions = EVENING_QUESTIONS;
    questionNumber = currentStep === ANSWER_STEPS.EVENING_PENDING ? 1 : parseInt(currentStep.split('_')[2]);
    fieldName = `Q_e_${questionNumber}`;
    nextStep = questionNumber < EVENING_QUESTIONS.length ? `Q_e_${questionNumber + 1}` : ANSWER_STEPS.COMPLETED;
  } else {
    console.log('[handleQuestionAnswer] Невідомий крок:', currentStep);
    await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Щось пішло не так. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
  try {
    await responseService.createOrUpdateResponse(tgId, userName, questionType, currentStep, questionNumber, answer, fieldName);
    console.log(`[handleQuestionAnswer] Збережено відповідь для ${questionType} Q${questionNumber}`);
    if (nextStep === ANSWER_STEPS.COMPLETED) {
      const affirmation = await affirmationService.getAffirmationAndMarkUsed();
      const affirmationField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
      await responseService.createOrUpdateResponse(tgId, userName, questionType, nextStep, 0, affirmation, affirmationField, true);
      console.log(`[handleQuestionAnswer] Збережено афірмацію для ${questionType}`);
      await userService.updateUserStep(tgId, nextStep);
      const endMessage = questionType === QUESTION_TYPES.MORNING
        ? `✅ Ранкові питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`
        : `✅ Вечірні питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`;
      await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
      await new Promise((res) => setTimeout(res, 1500));
      return ctx.reply(endMessage, keyboards.mainMenuKeyboard());
    }
    await userService.updateUserStep(tgId, nextStep);
    const nextQuestionIndex = parseInt(nextStep.split('_')[2]) - 1;
    const nextQuestion = questions[nextQuestionIndex];
    await ctx.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[botController] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply(`${nextQuestionIndex + 1}️⃣/${questions.length} ${nextQuestion}`);
  } catch (error) {
    console.error('[handleQuestionAnswer] Помилка:', error);
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