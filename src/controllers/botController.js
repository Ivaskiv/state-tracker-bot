// src/controllers/botController.js - ВИПРАВЛЕНО: правильна логіка обробки

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from '../auth/modules/auth.js';
import keyboards from '../utils/keyboards.js';
import { ANSWER_STEPS } from '../config/constants.js';

const botController = (bot) => {
  console.log('[botController] ✅ Ініціалізація...');

  // /start команда
  bot.start(async (ctx) => {
    console.log(`🚀 /start від ${ctx.from.id}`);
    await handleStart(ctx);
  });

  // Текстові повідомлення
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    
    if (!text) return;
    
    console.log(`💬 Текст від ${tgId}: "${text}"`);

    try {
      // 1. ОНБОРДИНГ (найвищий пріоритет)
      const isOnboarding = await handleRegistrationStep(ctx);
      if (isOnboarding) return;

      // 2. Перевіряємо чи користувач зареєстрований
      const user = await userService.getUserByTelegramId(tgId);
      if (!user || !user['UserRegistered']) {
        await ctx.reply('Спочатку зареєструйся /start');
        return;
      }

      // 3. Активні сесії
      const step = user.Answer_Step;
      
      // AI Наставник активний
      if (aiMentorSession.isActive(tgId)) {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }
      
      // Колесо балансу активне 
      if (step && step.startsWith('mw_')) {
        await wheelBalanceController.handleWheelText(ctx, text);
        return;
      }
      
      // Ранкові/вечірні питання активні
      if (step && (step.startsWith('m_') || step.startsWith('e_'))) {
        await handleQuestionFlow(ctx, user, text);
        return;
      }

      // 4. Перевіряємо підписку для функцій
      const hasAccess = user['Active_Subscription_Status']?.includes('✅ Активна');
      
      // 5. Обробка команд меню
      switch (text) {
        case '🤖 AI наставник':
          if (!hasAccess) {
            await ctx.reply('🚫 Потрібна активна підписка', keyboards.subscriptionKeyboard());
            return;
          }
          await aiMentorController.handleAIMentorRequest(ctx);
          break;
          
        case '🎯 Колесо балансу':
          if (!hasAccess) {
            await ctx.reply('🚫 Потрібна активна підписка', keyboards.subscriptionKeyboard());
            return;
          }
          await wheelBalanceController.handleWheelBalanceRequest(ctx);
          break;
          
        case '💰 Підписка':
          await showSubscriptionInfo(ctx, user);
          break;
          
        case '💎 Афірмація':
          const affirmation = getRandomAffirmation();
          await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
          break;
          
        case '📊 Мій прогрес':
          await showProgress(ctx, user);
          break;
          
        case '❓ Допомога':
          await ctx.reply('❓ ДОПОМОГА\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com', keyboards.mainMenuKeyboard());
          break;
          
        case "📞 Зв'язок з нами":
          await ctx.reply('📞 ЗВ\'ЯЗОК З НАМИ\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316', keyboards.mainMenuKeyboard());
          break;
          
        default:
          await ctx.reply('Оберіть пункт з меню нижче:', keyboards.mainMenuKeyboard());
      }

    } catch (error) {
      console.error('❌ Помилка text handler:', error);
      await ctx.reply('❌ Помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
    }
  });

  // Callback queries
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    console.log(`📱 Callback: ${data} від ${tgId}`);

    try {
      // Онбординг callbacks
      if (await handleOnboardingCallback(ctx)) {
        return;
      }

      // AI наставник callbacks
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // Колесо балансу callbacks
      if (data.startsWith('wheel_') || data.startsWith('mw_')) {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      // Підписка callbacks
      if (data.startsWith('plan_') || data === 'subscription_plans') {
        await handleSubscriptionCallback(ctx, data);
        return;
      }

      await ctx.answerCbQuery('Команда не розпізнана');

    } catch (error) {
      console.error(`❌ Помилка callback ${data}:`, error);
      await ctx.answerCbQuery('Помилка');
    }
  });

  console.log('✅ Bot controller ініціалізовано');
  return { bot };
};

// Допоміжні функції
const handleQuestionFlow = async (ctx, user, text) => {
  // Обробка ранкових/вечірніх питань - спрощена реалізація
  const step = user.Answer_Step;
  
  if (step.startsWith('m_')) {
    // Ранкові питання
    const questionNum = parseInt(step.split('_')[1].replace('q', ''));
    await saveAnswer(ctx.from.id, step, text);
    
    if (questionNum < 6) {
      const nextStep = `m_q${questionNum + 1}`;
      await userService.updateUserStep(ctx.from.id, nextStep);
      await ctx.reply(getQuestionText(nextStep));
    } else {
      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      await ctx.reply('🎉 Ранкова рефлексія завершена!\n\n✨ Гарного дня!', keyboards.mainMenuKeyboard());
    }
  }
  
  if (step.startsWith('e_')) {
    // Вечірні питання - аналогічно
    const questionNum = parseInt(step.split('_')[1].replace('q', ''));
    await saveAnswer(ctx.from.id, step, text);
    
    if (questionNum < 5) {
      const nextStep = `e_q${questionNum + 1}`;
      await userService.updateUserStep(ctx.from.id, nextStep);
      await ctx.reply(getQuestionText(nextStep));
    } else {
      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      await ctx.reply('🌙 Вечірня рефлексія завершена!\n\n😴 Солодких снів!', keyboards.mainMenuKeyboard());
    }
  }
};

const saveAnswer = async (tgId, step, answer) => {
  // Збереження відповіді в базу
  console.log(`💾 Збереження відповіді ${tgId}: ${step} = ${answer.substring(0, 50)}...`);
  // TODO: Реалізувати збереження в Airtable
};

const getQuestionText = (step) => {
  const questionMap = {
    'm_q1': 'Хто я сьогодні? Опиши з позиції сили (1 речення).',
    'm_q2': 'Яка я? Обери 3–5 якостей.',
    'm_q3': 'Міні-оновлення цілей на рік — введи 1–3 на сьогодні',
    'm_q4': 'На що фокус сьогодні?',
    'm_q5': 'Мій стан зараз?',
    'm_q6': 'Чому я гідна цього вже зараз?',
    'e_q1': 'Що наповнило мене енергією сьогодні?',
    'e_q2': 'Де я злила енергію?',
    'e_q3': 'Яка програма активувалась?',
    'e_q4': 'Я діяла зі сили чи страху?',
    'e_q5': 'Моя головна перемога сьогодні?'
  };
  return questionMap[step] || 'Питання не знайдено';
};

const getRandomAffirmation = () => {
  const affirmations = [
    'Моя енергія створює позитивні зміни',
    'Я заслуговую на все найкраще прямо зараз',
    'Моя рішучість творить нові можливості',
    'Щодня я впевнено просуваюся до мети',
    'Я довіряю своїй інтуїції та внутрішній силі'
  ];
  return affirmations[Math.floor(Math.random() * affirmations.length)];
};

const showSubscriptionInfo = async (ctx, user) => {
  const status = user['Active_Subscription_Status'] || '❌ Неактивна';
  await ctx.reply(`💰 ПІДПИСКА: ${status}`, keyboards.subscriptionKeyboard());
};

const showProgress = async (ctx, user) => {
  await ctx.reply('📊 ПРОГРЕС\n\nТут буде ваша статистика...', keyboards.mainMenuKeyboard());
};

const handleSubscriptionCallback = async (ctx, data) => {
  if (data === 'subscription_plans') {
    await ctx.editMessageText('💰 Оберіть план:', keyboards.subscriptionPlansKeyboard());
  }
  
  if (data.startsWith('plan_')) {
    const plan = data.replace('plan_', '');
    await ctx.editMessageText(`Обрано план: ${plan}\n\n💳 Перенаправляємо на оплату...`);
  }
  
  await ctx.answerCbQuery('Опрацьовано');
};

export default botController;
