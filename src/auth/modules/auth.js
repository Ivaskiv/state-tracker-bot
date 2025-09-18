// src/auth/modules/auth.js - ВИПРАВЛЕНО ЛОГІКУ ПЕРЕВІРКИ КОРИСТУВАЧА

import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';

const TIMEZONES = [
  'Europe/Kiev (UTC+2)',
  'Europe/Prague (UTC+1)', 
  'Europe/Berlin (UTC+1)',
  'Europe/London (UTC+0)',
  'Europe/Paris (UTC+1)',
  'America/New_York (UTC-5)',
  'Asia/Dubai (UTC+4)'
];

const timezoneKeyboard = () => ({
  reply_markup: {
    keyboard: TIMEZONES.map(tz => [tz]),
    resize_keyboard: true,
    one_time_keyboard: true
  }
});

export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  try {
    console.log(`[auth] 🔍 Перевірка користувача ${tgId} (${name})`);
    
    // ✅ ДЕТАЛЬНА ДІАГНОСТИКА
    const user = await userService.getUserByTelegramId(tgId);
    
    if (user) {
      console.log(`[auth] 👤 КОРИСТУВАЧ ЗНАЙДЕНИЙ:`, {
        tgId: user['TG_id'],
        name: user['User Name'],
        email: user['Email'],
        phone: user['Phone'],
        subscriptionStatus: user['Active_Subscription_Status'],
        answerStep: user['Answer_Step']
      });
    } else {
      console.log(`[auth] 👤 КОРИСТУВАЧ НЕ ЗНАЙДЕНИЙ для TG_id: ${tgId}`);
    }

    if (!user) {
      // ✅ НОВА РЕЄСТРАЦІЯ
      if (!ctx.session) ctx.session = {};
      ctx.session.step = 'reg_name';
      ctx.session.temp = { name };
      
      console.log(`[auth] 🆕 ПОЧАТОК нової реєстрації для ${tgId}, ім'я: ${name}`);
      
      await ctx.reply(`🌟 Вітаю в aiMentor, ${name}!\n\nПочнемо реєстрацію. Підтверди своє ім'я або введи інше:`, keyboards.skipKeyboard());
      return;
    }

    // ✅ ІСНУЮЧИЙ КОРИСТУВАЧ - детальна перевірка підписки
    console.log(`[auth] 🔄 Аналіз підписки користувача ${tgId}:`);
    
    const subscriptionStatus = user['Active_Subscription_Status'];
    const hasActiveSubscription = subscriptionStatus && subscriptionStatus.includes && subscriptionStatus.includes('✅ Активна');
    
    console.log(`[auth] 💰 Статус підписки:`, {
      rawStatus: subscriptionStatus,
      typeOfStatus: typeof subscriptionStatus,
      hasActiveSubscription: hasActiveSubscription,
      includesCheck: subscriptionStatus ? subscriptionStatus.includes('✅ Активна') : 'немає статусу'
    });
    
    if (hasActiveSubscription) {
      console.log(`[auth] ✅ Користувач ${tgId} має активну підписку`);
      await ctx.reply(`Привіт знову, ${name}! 👋\n\nГотовий продовжити трансформацію?`, keyboards.mainMenuKeyboard());
    } else {
      console.log(`[auth] ❌ Користувач ${tgId} НЕ має активної підписки`);
      console.log(`[auth] 📊 Детальна інформація про підписку:`, {
        subscriptionStatus: user['Active_Subscription_Status'],
        subscriptionPlan: user['Active Subscription Plan'],
        startDate: user['Start_Date'],
        endDate: user['End_Date']
      });
      
      await ctx.reply(
        `Привіт, ${name}! 👋\n\n❌ Твоя підписка неактивна.\n\nДля користування всіма функціями потрібна активна підписка.\n\n📞 Зв'яжіться з підтримкою: nadyastarway@gmail.com`,
        keyboards.subscriptionKeyboard()
      );
    }
  } catch (error) {
    console.error('[handleStart] ❌ КРИТИЧНА ПОМИЛКА:', {
      message: error.message,
      stack: error.stack,
      tgId,
      name
    });
    await ctx.reply('❌ Помилка. Спробуйте ще раз.');
  }
}

export async function handleRegistrationStep(ctx) {
  // ✅ ПЕРЕВІРЯЄМО СЕСІЮ НА КОЖНОМУ КРОЦІ
  if (!ctx.session) ctx.session = {};
  
  const step = ctx.session.step;
  const text = (ctx.message?.text || '').trim();
  
  console.log(`[auth] 📝 Крок реєстрації: ${step}, текст: "${text}"`);
  
  if (!step || !step.startsWith('reg_')) {
    console.log(`[auth] ⏭️ Не реєстраційний крок: ${step}`);
    return false;
  }

  try {
    if (step === 'reg_name') {
      if (!text && !ctx.session.temp?.name) {
        await ctx.reply('Введи ім\'я:', keyboards.skipKeyboard());
        return true;
      }
      
      if (!ctx.session.temp) ctx.session.temp = {};
      ctx.session.temp.name = text || ctx.session.temp.name || ctx.from.first_name;
      ctx.session.step = 'reg_email';
      
      console.log(`[auth] ✅ Ім'я збережено: ${ctx.session.temp.name}`);
      
      await ctx.reply('Вкажи email (або пропусти):', keyboards.skipKeyboard());
      return true;
    }

    if (step === 'reg_email') {
      if (!isSkip(text) && text && !isValidEmail(text)) {
        await ctx.reply('Некоректний email. Спробуй ще раз або пропусти:', keyboards.skipKeyboard());
        return true;
      }
      
      ctx.session.temp.email = isSkip(text) ? null : text;
      ctx.session.step = 'reg_phone';
      
      console.log(`[auth] ✅ Email збережено: ${ctx.session.temp.email || 'пропущено'}`);
      
      await ctx.reply('Номер телефону +380XXXXXXXXX (або пропусти):', keyboards.skipKeyboard());
      return true;
    }

    if (step === 'reg_phone') {
      if (!isSkip(text) && text && !isValidUaPhone(text)) {
        await ctx.reply('Формат: +380XXXXXXXXX. Спробуй ще раз або пропусти:', keyboards.skipKeyboard());
        return true;
      }
      
      ctx.session.temp.phone = isSkip(text) ? null : text;
      ctx.session.step = 'reg_timezone';
      
      console.log(`[auth] ✅ Телефон збережено: ${ctx.session.temp.phone || 'пропущено'}`);
      
      await ctx.reply('Обери часовий пояс для нагадувань:', timezoneKeyboard());
      return true;
    }

    if (step === 'reg_timezone') {
      const selectedTimezone = TIMEZONES.find(tz => text === tz);
      if (!selectedTimezone) {
        await ctx.reply('Обери часовий пояс зі списку:', timezoneKeyboard());
        return true;
      }

      const timezone = selectedTimezone.split(' ')[0];
      
      console.log(`[auth] 🏁 ЗАВЕРШЕННЯ РЕЄСТРАЦІЇ для ${ctx.from.id}:`, {
        name: ctx.session.temp.name,
        email: ctx.session.temp.email,
        phone: ctx.session.temp.phone,
        timezone
      });
      
      // ✅ ПЕРЕВІРЯЄМО ЧИ КОРИСТУВАЧ УЖЕ НЕ ІСНУЄ ПЕРЕД СТВОРЕННЯМ
      const existingUser = await userService.getUserByTelegramId(ctx.from.id);
      if (existingUser) {
        console.log(`[auth] ⚠️ КОРИСТУВАЧ УЖЕ ІСНУЄ під час реєстрації! ID: ${ctx.from.id}`);
        console.log(`[auth] Існуючий користувач:`, {
          tgId: existingUser['TG_id'],
          name: existingUser['User Name'],
          subscriptionStatus: existingUser['Active_Subscription_Status']
        });
        
        // Очищаємо сесію та перенаправляємо
        ctx.session = {};
        await ctx.reply('🎉 Ти вже зареєстрований!\n\nПереходимо до головного меню.', keyboards.mainMenuKeyboard());
        return true;
      }
      
      // ✅ СТВОРЮЄМО КОРИСТУВАЧА З ОБРОБКОЮ ПОМИЛОК
      try {
        console.log(`[auth] 🚀 СТВОРЕННЯ нового користувача...`);
        
        const user = await userService.createUser({
          tgId: ctx.from.id,
          name: ctx.session.temp.name,
          email: ctx.session.temp.email,
          phone: ctx.session.temp.phone,
          timezone
        });

        // ✅ ПЕРЕВІРЯЄМО ЩО КОРИСТУВАЧ РЕАЛЬНО СТВОРИВСЯ
        const verifyUser = await userService.getUserByTelegramId(ctx.from.id);
        if (!verifyUser) {
          throw new Error('Користувача створено, але він не знайдений в базі при перевірці');
        }

        // Очищаємо сесію після створення користувача
        ctx.session = {};

        console.log(`[auth] ✅ РЕЄСТРАЦІЯ УСПІШНА:`, {
          id: user.id,
          tgId: verifyUser['TG_id'],
          name: verifyUser['User Name'],
          subscriptionStatus: verifyUser['Active_Subscription_Status']
        });

        const welcomeMessage = `🎉 Реєстрацію завершено!\n\nТвій часовий пояс: ${selectedTimezone}`;
        await ctx.reply(welcomeMessage, keyboards.removeKeyboard());

        const hasActiveSubscription = verifyUser['Active_Subscription_Status']?.includes('✅ Активна');
        
        if (hasActiveSubscription) {
          await ctx.reply('🎯 Почнемо з оцінки твого життєвого балансу!');
          await wheelBalanceController.handleWheelBalanceRequest(ctx);
        } else {
          await ctx.reply(
            '💰 Для початку роботи потрібна активна підписка.\n\n📞 Зв\'яжіся з підтримкою для оформлення:\nnadyastarway@gmail.com',
            keyboards.subscriptionKeyboard()
          );
        }
        
        return true;
        
      } catch (createError) {
        console.error('[auth] ❌ КРИТИЧНА ПОМИЛКА створення користувача:', {
          message: createError.message,
          stack: createError.stack,
          tgId: ctx.from.id,
          name: ctx.session.temp.name
        });
        
        ctx.session = {};
        
        await ctx.reply(
          '❌ Помилка створення акаунта. Можливо проблема з базою даних.\n\n' + 
          'Спробуйте ще раз через хвилину або зв\'яжіться з підтримкою:\nnadyastarway@gmail.com'
        );
        
        return true;
      }
    }
    
  } catch (error) {
    console.error('[handleRegistrationStep] ❌ ПОМИЛКА РЕЄСТРАЦІЇ:', {
      message: error.message,
      stack: error.stack,
      step,
      tgId: ctx.from.id
    });
    await ctx.reply('❌ Помилка реєстрації. Спробуйте /start');
    ctx.session = {}; 
  }

  return false;
}