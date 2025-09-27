// src/controllers/flows/registrationController.js - Контролер реєстрації

import userService from '../../auth/services/userService.js';
import paymentService from '../../auth/services/paymentService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone, isValidName, formatEmail, formatPhone, formatName } from '../../utils/validators.js';
import { SUBSCRIPTION_PLANS, OB_STEPS } from '../../config/constants.js';

// Стани реєстрації (використовуємо ті ж самі що в OB_STEPS)
const REGISTRATION_STEPS = {
  PITCH: OB_STEPS.PITCH,
  NAME: OB_STEPS.NAME,
  EMAIL: OB_STEPS.EMAIL,
  PHONE: OB_STEPS.PHONE,
  PLAN: OB_STEPS.PLAN
};

const registrationController = {
  
  // ===== ОБРОБКА ТЕКСТУ =====
  async handleText(ctx) {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    const currentStep = ctx.session?.step;
    
    // Перевіряємо чи це крок реєстрації
    if (!currentStep || !Object.values(REGISTRATION_STEPS).includes(currentStep)) {
      return false; // Не є кроком реєстрації
    }
    
    console.log(`[REGISTRATION] 📝 Крок ${currentStep}, текст: "${text}"`);
    
    try {
      switch (currentStep) {
        case REGISTRATION_STEPS.NAME:
          await this.handleNameStep(ctx, text);
          break;
          
        case REGISTRATION_STEPS.EMAIL:
          await this.handleEmailStep(ctx, text);
          break;
          
        case REGISTRATION_STEPS.PHONE:
          await this.handlePhoneStep(ctx, text);
          break;
          
        default:
          console.log(`[REGISTRATION] ❓ Невідомий крок: ${currentStep}`);
          return false;
      }
      
      return true; // Оброблено як крок реєстрації
      
    } catch (error) {
      console.error(`[REGISTRATION] ❌ Помилка в кроці ${currentStep}:`, error);
      await ctx.reply('❌ Помилка реєстрації. Спробуй ще раз або /start');
      return true;
    }
  },

  // ===== ОБРОБКА CALLBACK =====
  async handleCallback(ctx, data) {
    const tgId = ctx.from.id;
    
    console.log(`[REGISTRATION] 📱 Callback: ${data}`);
    
    try {
      switch (data) {
        case 'start_registration':
        case 'onboarding_start':
          await this.startRegistration(ctx);
          return true;
          
        case 'about_bot':
        case 'onboarding_about':
          await this.showAboutBot(ctx);
          return true;
          
        case 'skip_step':
          await this.handleSkipStep(ctx);
          return true;
          
        case 'plan_free':
        case 'plan_trial':
          await this.handleTrialPlan(ctx);
          return true;
          
        case 'plan_week':
          await this.handlePaidPlan(ctx, 'WEEK');
          return true;
          
        case 'plan_month':
          await this.handlePaidPlan(ctx, 'MONTH');
          return true;
          
        case 'plan_year':
          await this.handlePaidPlan(ctx, 'YEAR');
          return true;
          
        default:
          return false; // Не є callback реєстрації
      }
    } catch (error) {
      console.error('[REGISTRATION] ❌ Помилка callback:', error);
      await ctx.answerCbQuery('Помилка');
      return true;
    }
  },

  // ===== ПОЧАТОК РЕЄСТРАЦІЇ =====
  async startRegistration(ctx) {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    console.log(`[REGISTRATION] 🚀 Початок реєстрації для ${tgId}`);
    
    ctx.session = ctx.session || {};
    ctx.session.step = REGISTRATION_STEPS.NAME;
    ctx.session.temp = { tgId: String(tgId) };
    
    const message = `📝 Як тебе звати?\n\n💡 Введи своє ім'я або обери кнопку нижче:`;
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Називатися: ${name}`, callback_data: `use_name_${name}` }],
          [{ text: 'Ввести інше ім\'я', callback_data: 'enter_custom_name' }],
          [{ text: '⏭️ Пропустити', callback_data: 'skip_step' }]
        ]
      }
    });
    
    await ctx.answerCbQuery('Початок реєстрації');
  },

  // ===== КРОК: ІМ'Я =====
  async handleNameStep(ctx, name) {
    if (!isValidName(name)) {
      await ctx.reply(
        '⚠️ Введи правильне ім\'я (2-50 символів):',
        keyboards.skipKeyboard()
      );
      return;
    }
    
    ctx.session.temp.name = formatName(name);
    ctx.session.step = REGISTRATION_STEPS.EMAIL;
    
    await ctx.reply(
      `✅ Чудово, ${name}!\n\n📧 Тепер введи свій email:`,
      keyboards.skipKeyboard()
    );
  },

  // ===== КРОК: EMAIL =====
  async handleEmailStep(ctx, email) {
    if (!isValidEmail(email)) {
      await ctx.reply(
        '⚠️ Невірний email. Введи коректний (example@gmail.com):',
        keyboards.skipKeyboard()
      );
      return;
    }
    
    ctx.session.temp.email = formatEmail(email);
    ctx.session.step = REGISTRATION_STEPS.PHONE;
    
    await ctx.reply(
      '✅ Email збережено!\n\n📱 Введи телефон (+380XXXXXXXXX):',
      keyboards.skipKeyboard()
    );
  },

  // ===== КРОК: ТЕЛЕФОН =====
  async handlePhoneStep(ctx, phone) {
    const formattedPhone = formatPhone(phone);
    
    if (!isValidUaPhone(formattedPhone)) {
      await ctx.reply(
        '⚠️ Неправильний телефон. Введи +380XXXXXXXXX:',
        keyboards.skipKeyboard()
      );
      return;
    }
    
    ctx.session.temp.phone = formattedPhone;
    ctx.session.step = REGISTRATION_STEPS.PLAN;
    
    await ctx.reply(
      '✅ Телефон збережено!\n\n🎁 Останній крок - обери план:',
      keyboards.subscriptionPlansKeyboard()
    );
  },

  // ===== ПРОПУСК КРОКУ =====
  async handleSkipStep(ctx) {
    const currentStep = ctx.session?.step;
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    switch (currentStep) {
      case REGISTRATION_STEPS.NAME:
        ctx.session.temp.name = name;
        ctx.session.step = REGISTRATION_STEPS.EMAIL;
        await ctx.reply('📧 Введи email:', keyboards.skipKeyboard());
        break;
        
      case REGISTRATION_STEPS.EMAIL:
        ctx.session.temp.email = `user${tgId}@temp.com`;
        ctx.session.step = REGISTRATION_STEPS.PHONE;
        await ctx.reply('📱 Введи телефон:', keyboards.skipKeyboard());
        break;
        
      case REGISTRATION_STEPS.PHONE:
        ctx.session.temp.phone = '+380000000000';
        ctx.session.step = REGISTRATION_STEPS.PLAN;
        await ctx.reply('🎁 Обери план:', keyboards.subscriptionPlansKeyboard());
        break;
        
      default:
        await ctx.reply('❌ Цей крок не можна пропустити');
    }
    
    await ctx.answerCbQuery('Крок пропущено');
  },

  // ===== БЕЗКОШТОВНИЙ ПЛАН =====
  async handleTrialPlan(ctx) {
    const tgId = ctx.from.id;
    
    try {
      console.log(`[REGISTRATION] 🧪 Активація пробного плану для ${tgId}`);
      
      // Створюємо користувача
      const userData = {
        tgId: String(tgId),
        name: ctx.session.temp?.name || ctx.from.first_name || 'Користувач',
        email: ctx.session.temp?.email || `user${tgId}@temp.com`,
        phone: ctx.session.temp?.phone || '+380000000000',
        timezone: 'Europe/Kyiv',
        registrationStatus: 'Active'
      };
      
      const user = await userService.createUser(userData);
      
      if (!user) {
        throw new Error('Не вдалося створити користувача');
      }
      
      // Активуємо пробну підписку
      const trialActivated = await paymentService.activateTrialSubscription(tgId, 7);
      
      if (!trialActivated) {
        console.warn(`[REGISTRATION] ⚠️ Не вдалося активувати пробну підписку для ${tgId}`);
      }
      
      // Очищаємо сесію реєстрації
      ctx.session.step = undefined;
      ctx.session.temp = {};
      
      const message = 
        `🎉 Реєстрацію завершено!\n\n` +
        `🧪 Пробна підписка активована на 7 днів\n\n` +
        `🎯 Тепер заповн перше колесо балансу для персоналізації AI-наставника\n\n` +
        `Готова почати?`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Заповнити колесо балансу', callback_data: 'wheel_start' }],
            [{ text: '🏠 До головного меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
      await ctx.answerCbQuery('Пробна підписка активована!');
      
    } catch (error) {
      console.error('[REGISTRATION] ❌ Помилка активації пробної підписки:', error);
      
      await ctx.reply(
        '❌ Помилка активації пробної підписки.\n\n💡 Спробуй ще раз або зверніся до підтримки.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Спробувати ще раз', callback_data: 'plan_trial' }],
              [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
              [{ text: '💰 Платні плани', callback_data: 'subscription_plans' }]
            ]
          }
        }
      );
      
      await ctx.answerCbQuery('Помилка активації');
    }
  },

  // ===== ПЛАТНИЙ ПЛАН =====
  async handlePaidPlan(ctx, planKey) {
    const tgId = ctx.from.id;
    
    try {
      console.log(`[REGISTRATION] 💰 Обробка платного плану ${planKey} для ${tgId}`);
      
      const planInfo = SUBSCRIPTION_PLANS[planKey];
      if (!planInfo) {
        await ctx.answerCbQuery('Невірний план');
        return;
      }
      
      // Створюємо користувача
      const userData = {
        tgId: String(tgId),
        name: ctx.session.temp?.name || ctx.from.first_name || 'Користувач',
        email: ctx.session.temp?.email || `user${tgId}@temp.com`,
        phone: ctx.session.temp?.phone || '+380000000000',
        timezone: 'Europe/Kyiv',
        registrationStatus: 'Pending'
      };
      
      const user = await userService.createUser(userData);
      
      if (!user) {
        throw new Error('Не вдалося створити користувача');
      }
      
      // Оновлюємо статус як очікує оплати
      await userService.updateUser(tgId, {
        'Subscription Status': 'Pending',
        'Active_Subscription_Status': '⏳ Очікує оплати'
      });
      
      // Очищаємо сесію реєстрації
      ctx.session.step = undefined;
      ctx.session.temp = {};
      
      const message = 
        `💳 ОПЛАТА ПІДПИСКИ\n\n` +
        `План: ${planInfo.name}\n` +
        `Вартість: ${planInfo.price}€\n` +
        `Період: ${planInfo.duration} днів\n\n` +
        `Після оплати підписка активується автоматично.`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Оплатити зараз', callback_data: `subscribe_${planKey.toLowerCase()}` }],
            [{ text: '🧪 Пробна версія', callback_data: 'plan_trial' }],
            [{ text: '⏭ Пізніше', callback_data: 'main_menu' }]
          ]
        }
      });
      
      await ctx.answerCbQuery(`План: ${planInfo.name}`);
      
    } catch (error) {
      console.error('[REGISTRATION] ❌ Помилка платного плану:', error);
      
      await ctx.reply(
        '❌ Помилка обробки плану.\n\n💡 Спробуй ще раз або обери пробну версію.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Спробувати ще раз', callback_data: `plan_${planKey.toLowerCase()}` }],
              [{ text: '🧪 Пробна версія', callback_data: 'plan_trial' }],
              [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
            ]
          }
        }
      );
      
      await ctx.answerCbQuery('Помилка');
    }
  },

  // ===== ІНФОРМАЦІЯ ПРО БОТА =====
  async showAboutBot(ctx) {
    const message = 
      `🤖 AI МОТИВАТОР-КОУЧ\n\n` +
      `✨ Що я роблю:\n` +
      `• Ранкові питання для фокусу\n` +
      `• Вечірні питання для рефлексії\n` +
      `• AI-наставник для підтримки\n` +
      `• Колесо балансу для аналізу життя\n` +
      `• Персональні звіти та рекомендації\n\n` +
      `🎯 Результат: більше усвідомленості, мотивації та досягнень!`;
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }],
          [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
        ]
      }
    });
    
    await ctx.answerCbQuery('Інформація про бота');
  },

  // ===== ПЕРЕВІРКА СТАТУСУ РЕЄСТРАЦІЇ =====
  isRegistrationStep(step) {
    return Object.values(REGISTRATION_STEPS).includes(step);
  },

  // ===== ПЕРЕВІРКА CALLBACK РЕЄСТРАЦІЇ =====
  isRegistrationCallback(data) {
    const registrationCallbacks = [
      'start_registration', 'onboarding_start', 'onboarding_about', 'about_bot',
      'skip_step', 'plan_free', 'plan_trial', 'plan_week', 'plan_month', 'plan_year',
      'activate_trial'
    ];
    return registrationCallbacks.includes(data);
  },

  // ===== ЗАВЕРШЕННЯ РЕЄСТРАЦІЇ =====
  async completeRegistration(ctx) {
    const tgId = ctx.from.id;
    
    try {
      // Оновлюємо користувача як зареєстрованого
      await userService.updateUser(tgId, {
        UserRegistered: true,
        'Registration Date': new Date().toISOString(),
        Status: 'Registered User',
        Answer_Step: 'completed'
      });
      
      // Очищаємо сесію
      ctx.session.step = undefined;
      ctx.session.temp = {};
      
      console.log(`[REGISTRATION] ✅ Реєстрація завершена для ${tgId}`);
      return true;
      
    } catch (error) {
      console.error('[REGISTRATION] ❌ Помилка завершення реєстрації:', error);
      return false;
    }
  }
};

export default registrationController;

console.log('✅ [registrationController] Контролер реєстрації ініціалізовано');