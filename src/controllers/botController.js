// src/controllers/botController.js
import userService from '../services/userService.js';
import keyboards from '../utils/keyboards.js';
import affirmationService from '../services/affirmationService.js';
import responseService from '../services/responseService.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS, ANSWER_STEPS } from '../config/constants.js';
import { getBase } from '../config/database.js';

export default function botController(bot) {
  bot.catch((err, ctx) => {
    console.error('[botController] Error:', err);
    bot.telegram.sendChatAction(ctx.from.id, 'typing');
    setTimeout(() => ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard()), 1500);
  });

  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    let user = await userService.getUserByTelegramId(tgId);

    await bot.telegram.sendChatAction(tgId, 'typing');
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

    console.log(`[botController] Received message: "${text}" from user ${tgId}`);

    ctx.session = ctx.session || {};

    await bot.telegram.sendChatAction(tgId, 'typing');
    await new Promise((res) => setTimeout(res, 1500));

    // --- Registration ---
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
      const newUser = await userService.createUser({
        tgId,
        name: ctx.session.temp.name,
      });
      ctx.session.step = null;
      ctx.session.temp = {};
      return ctx.reply(profileMessage(newUser), keyboards.mainMenuKeyboard());
    }

    // --- Handle question answers ---
    if (user && user.Answer_Step && ![ANSWER_STEPS.END_MORNING, ANSWER_STEPS.END_EVENING].includes(user.Answer_Step)) {
      return await handleQuestionAnswer(ctx, user, text);
    }

    // --- Menu ---
    if (text === '📝 Ранкові питання') {
      console.log(`[botController] Starting morning questions for ${tgId}`);
      return await startMorningQuestions(ctx, user);
    }

    if (text === '🌙 Вечірні питання') {
      console.log(`[botController] Starting evening questions for ${tgId}`);
      return await startEveningQuestions(ctx, user);
    }

    if (text === '💎 Афірмація') {
      console.log(`[botController] Getting affirmation for ${tgId}`);
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`🌀 Афірмація:\n\n${aff}`, keyboards.mainMenuKeyboard());
    }

    if (text === '📊 Мій прогрес') {
      console.log(`[botController] Showing progress for ${tgId}`);
      return await showUserProgress(ctx, user);
    }

    if (text === '💰 Підписка') {
      console.log(`[botController] Showing subscription for ${tgId}`);
      return await showSubscriptionInfo(ctx, user);
    }

    if (text === '❓ Допомога') {
      const helpText = `❓ ДОПОМОГА ТА КОНТАКТИ

Якщо виникли питання — пишіть на nadyastarway@gmail.com
Або перегляньте інструкції у головному меню.`;
      return ctx.reply(helpText, keyboards.mainMenuKeyboard());
    }

    if (text === '📞 Зв\'язок з нами') {
      const contactText = `📞 ЗВ\'ЯЗОК З НАМИ

💬 **ТЕХНІЧНА ПІДТРИМКА:**
Email: nadyastarway@gmail.com
Telegram: @Nadya2316 (ментор)
Telegram: @vira_333 (техпідтримка)

Напиши нам, якщо:
• Виникли проблеми з ботом
• Не працює підписка  
• Потрібна допомога з налаштуванням

📋 **ПИТАННЯ ПРО МАРАФОН:**
Якщо у тебе є питання про програму або методику — пиши ментору.

⏰ **ЧАС ВІДПОВІДІ:**
Зазвичай відповідаємо протягом 24 годин.

🎯 **ЗАМОВИТИ ПЕРСОНАЛЬНУ КОНСУЛЬТАЦІЮ:**
Хочеш особисту роботу з ментором?
Напиши на Email з темою \"Персональна консультація\" — обговоримо можливості.`;
      return ctx.reply(contactText, keyboards.supportKeyboard());
    }

    if (text === '📋 Інструкції') {
      const instructionsText = `📋 ЯК КОРИСТУВАТИСЯ БОТОМ

🚀 **ПОЧАТОК РОБОТИ:**
• Натисни /start для реєстрації
• Перевір свою підписку в розділі "💰 Підписка"
• Активуй підписку за потреби

📝 **ЩОДЕННІ ПРАКТИКИ:**
• "📝 Ранкові питання" — відповідай вранці для налаштування на день
• "🌙 Вечірні питання" — рефлексія в кінці дня
• "💎 Афірмація" — отримуй 1 натхненну фразу щодня

📊 **ВІДСТЕЖЕННЯ ПРОГРЕСУ:**
• "📊 Мій прогрес" — переглянь статистику відповідей
• Відповідай на питання регулярно для кращого результату

🎯 **21-ДЕННИЙ МАРАФОН:**
• Кожен день: відео → аудіо → PDF → завдання
• Наступний урок відкривається тільки після виконання завдання  
• Проходь крок за кроком для максимального ефекту

💡 **ПОРАДИ:**
• Використовуй бота щодня для формування звичок
• Будь чесною у відповідях — це для твого розвитку
• У разі технічних проблем звертайся через "📞 Зв\'язок з нами"`;
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

    await bot.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));

    if (data === 'main_menu') {
      await ctx.reply('🏠 Головне меню', keyboards.mainMenuKeyboard());
      return ctx.answerCbQuery();
    }

    await ctx.answerCbQuery();
  });
}

async function startMorningQuestions(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }

  const tgId = ctx.from.id;
  await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);

  await ctx.telegram.sendChatAction(tgId, 'typing');
  await new Promise((res) => setTimeout(res, 1500));
  await ctx.reply(`🌞 Ранкові питання для фокусу та активації!\nВідповідай щиро ✨\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
}

async function startEveningQuestions(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }

  const tgId = ctx.from.id;
  await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);

  await ctx.telegram.sendChatAction(tgId, 'typing');
  await new Promise((res) => setTimeout(res, 1500));
  await ctx.reply(`🌙 Вечірні питання для аналізу дня!\nЧас підсумувати та зафіксувати перемоги 🏆\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
}

async function showSubscriptionInfo(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }

  const name = user['User Name'] || 'Користувач';
  const active = user['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user['Active Subscription Plan'] || '—';
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

  const subscriptionText = `📦 ПІДПИСКА:

${active.includes('✅') ? `✅ Активна
📋 План: ${plan}
🚀 Початок: ${start}
📅 Діє до: ${end}` : '❌ Неактивна'}

📝 Реєстраційні дані: ✅ Заповнені`;

  await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
  await new Promise((res) => setTimeout(res, 1500));
  return ctx.reply(subscriptionText, keyboards.mainMenuKeyboard());
}

async function showUserProgress(ctx, user) {
  if (!user) {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Спочатку зареєструйтесь /start');
  }

  try {
    const base = getBase();
    const tgId = ctx.from.id;

    const responses = await base('Responses')
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
      })
      .all();

    let totalResponses = responses.length;
    let morningResponses = responses.filter((r) => r.fields['Question Type'] === 'Morning').length;
    let eveningResponses = responses.filter((r) => r.fields['Question Type'] === 'Evening').length;

    const progressText = `📊 ВАШ ПРОГРЕС:

📝 Всього відповідей: ${totalResponses}
🌅 Ранкові: ${morningResponses}
🌙 Вечірні: ${eveningResponses}

💡 Пропозиція: продовжуйте відповідати щодня для кращої інтроспекції та розвитку.`;

    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply(progressText, keyboards.mainMenuKeyboard());
  } catch (error) {
    console.error('[showUserProgress] Error:', error);
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('📊 Функція прогресу тимчасово недоступна', keyboards.mainMenuKeyboard());
  }
}

async function handleQuestionAnswer(ctx, user, answer) {
  const tgId = ctx.from.id;
  const currentStep = user.Answer_Step;
  const userName = user['User Name'] || 'Користувач';

  console.log(`[handleQuestionAnswer] User ${tgId}, Step: ${currentStep}`);

  let questionType, questions, questionNumber, nextStep, fieldName;

  if (currentStep.startsWith('Q_m_')) {
    questionType = 'Morning';
    questions = MORNING_QUESTIONS;
    questionNumber = parseInt(currentStep.split('_')[2]);
    fieldName = `Q_m_${questionNumber}`; // Важливо: назва поля Airtable
    nextStep = questionNumber < MORNING_QUESTIONS.length ? `Q_m_${questionNumber + 1}` : ANSWER_STEPS.END_MORNING;
  } else if (currentStep.startsWith('Q_e_')) {
    questionType = 'Evening';
    questions = EVENING_QUESTIONS;
    questionNumber = parseInt(currentStep.split('_')[2]);
    fieldName = `Q_e_${questionNumber}`; // Важливо: назва поля Airtable
    nextStep = questionNumber < EVENING_QUESTIONS.length ? `Q_e_${questionNumber + 1}` : ANSWER_STEPS.END_EVENING;
  } else {
    console.log('[handleQuestionAnswer] Unknown step format:', currentStep);
    await ctx.telegram.sendChatAction(tgId, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Щось пішло не так. Спробуйте почати спочатку.', keyboards.mainMenuKeyboard());
  }

  try {
    console.log(`[DEBUG] Saving answer for field: ${fieldName}, answer: ${answer}`);
    await responseService.createOrUpdateResponse(tgId, userName, questionType, currentStep, answer, fieldName);
    console.log(`[handleQuestionAnswer] Saved answer for ${questionType} ${fieldName}`);

    if (nextStep === ANSWER_STEPS.END_MORNING || nextStep === ANSWER_STEPS.END_EVENING) {
      const affirmation = await affirmationService.getAffirmationAndMarkUsed();
      await responseService.createOrUpdateResponse(tgId, userName, questionType, nextStep, affirmation, 'Affirmation');

      await userService.updateUserStep(tgId, nextStep);

      const endMessage =
        questionType === 'Morning'
          ? `✅ Ранкові питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`
          : `✅ Вечірні питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`;

      await ctx.telegram.sendChatAction(tgId, 'typing');
      await new Promise((res) => setTimeout(res, 1500));
      return ctx.reply(endMessage, keyboards.mainMenuKeyboard());
    }

    await userService.updateUserStep(tgId, nextStep);

    const nextQuestionIndex = parseInt(nextStep.split('_')[2]) - 1;
    const nextQuestion = questions[nextQuestionIndex];

    await ctx.telegram.sendChatAction(tgId, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply(`${nextQuestionIndex + 1}️⃣/${questions.length} ${nextQuestion}`);
  } catch (error) {
    console.error('[handleQuestionAnswer] Error:', error);
    await ctx.telegram.sendChatAction(tgId, 'typing');
    await new Promise((res) => setTimeout(res, 1500));
    return ctx.reply('Помилка при збереженні відповіді. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
}

function profileMessage(user) {
  const name = user['User Name'] || 'Користувач';
  const tg = user['TG_id'] || '—';
  const active = user['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user['Active Subscription Plan'] || '—';
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

  return `📊 ПРОФІЛЬ

👤 Ім\'я: ${name}
🆔 ID: ${tg}

📦 ПІДПИСКА:
${active.includes('✅') ? `${active}
📋 План: ${plan}
🚀 Початок: ${start}
📅 Діє до: ${end}` : '❌ Неактивна'}`;
}