// src/auth/modules/auth.js - ВИПРАВЛЕНО РЕЄСТРАЦІЮ

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

// Виправлена функція handleStart в src/auth/modules/auth.js

export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  try {
    console.log(`[auth] 🔍 ПОЧАТОК /start для користувача:`);
    console.log(`- TG_id: ${tgId} (тип: ${typeof tgId})`);
    console.log(`- Ім'я: ${name}`);
    console.log(`- Username: @${ctx.from.username || 'немає'}`);
    
    // ✅ КРОК 1: ОБОВ'ЯЗКОВА ПЕРЕВІРКА КОРИСТУВАЧА В ТАБЛИЦІ Users
    console.log(`[auth] 🔍 Перевіряємо наявність користувача в таблиці Users...`);
    
    let user;
    try {
      user = await userService.getUserByTelegramId(tgId);
      console.log(`[auth] 📊 Результат пошуку користувача:`, {
        found: !!user,
        tgId: user?.['TG_id'] || 'не знайдено',
        name: user?.['User Name'] || 'не знайдено',
        subscription: user?.['Active_Subscription_Status'] || 'не знайдено'
      });
    } catch (searchError) {
      console.error(`[auth] ❌ ПОМИЛКА пошуку користувача:`, searchError);
      await ctx.reply('❌ Помилка доступу до бази даних. Спробуйте пізніше.');
      return;
    }
    
    // ✅ КРОК 2: ЯКЩО КОРИСТУВАЧ ЗНАЙДЕНИЙ - АНАЛІЗУЄМО ПІДПИСКУ
    if (user) {
      console.log(`[auth] ✅ КОРИСТУВАЧ ІСНУЄ В БАЗІ`);
      console.log(`[auth] 📋 Повна інформація:`, {
        tgId: user['TG_id'],
        name: user['User Name'],
        email: user['Email'] || 'не вказано',
        phone: user['Phone'] || 'не вказано',
        subscriptionStatus: user['Active_Subscription_Status'] || 'немає статусу',
        subscriptionPlan: user['Active Subscription Plan'] || 'немає плану',
        startDate: user['Start_Date'] || 'немає дати',
        endDate: user['End_Date'] || 'немає дати',
        answerStep: user['Answer_Step'] || 'немає кроку'
      });

      // Перевіряємо активність підписки
      const subscriptionStatus = user['Active_Subscription_Status'];
      const hasActiveSubscription = subscriptionStatus && 
                                   typeof subscriptionStatus === 'string' && 
                                   subscriptionStatus.includes('✅ Активна');
      
      console.log(`[auth] 💰 АНАЛІЗ ПІДПИСКИ:`);
      console.log(`- Статус: "${subscriptionStatus}"`);
      console.log(`- Тип статусу: ${typeof subscriptionStatus}`);
      console.log(`- Має активну: ${hasActiveSubscription}`);
      
      if (hasActiveSubscription) {
        console.log(`[auth] ✅ Користувач ${tgId} має АКТИВНУ підписку`);
        await ctx.reply(
          `Привіт знову, ${name}! 👋\n\nГотовий продовжити трансформацію?`, 
          keyboards.mainMenuKeyboard()
        );
      } else {
        console.log(`[auth] ❌ Користувач ${tgId} НЕ має активної підписки`);
        await ctx.reply(
          `Привіт, ${name}! 👋\n\n❌ Твоя підписка неактивна.\n\nДля користування всіма функціями потрібна активна підписка.\n\n📞 Зв'яжіться з підтримкою: nadyastarway@gmail.com`,
          keyboards.subscriptionKeyboard()
        );
      }
      return;
    }

    // ✅ КРОК 3: КОРИСТУВАЧА НЕМАЄ - ПОЧАТОК РЕЄСТРАЦІЇ
    console.log(`[auth] 🆕 КОРИСТУВАЧ НЕ ЗНАЙДЕНИЙ - розпочинаємо реєстрацію`);
    
    // Ініціалізуємо сесію
    if (!ctx.session) {
      ctx.session = {};
      console.log(`[auth] 🔧 Створено нову сесію`);
    }
    
    ctx.session.step = 'reg_name';
    ctx.session.temp = { 
      name: name,
      tgId: tgId,
      username: ctx.from.username || null
    };
    
    console.log(`[auth] ✅ СЕСІЯ РЕЄСТРАЦІЇ ініціалізована:`, {
      step: ctx.session.step,
      tempName: ctx.session.temp.name,
      tempTgId: ctx.session.temp.tgId
    });
    
    await ctx.reply(
      `🌟 Вітаю в aiMentor, ${name}!\n\nПочнемо реєстрацію. Підтверди своє ім'я або введи інше:`, 
      keyboards.skipKeyboard()
    );
    
  } catch (error) {
    console.error('[handleStart] ❌ КРИТИЧНА ПОМИЛКА:', {
      message: error.message,
      stack: error.stack,
      tgId,
      name
    });
    await ctx.reply('❌ Помилка системи. Спробуйте /start ще раз або зв\'яжіться з підтримкою: nadyastarway@gmail.com');
  }
}

export async function handleRegistrationStep(ctx) {
  // ВИПРАВЛЕНО: перевіряємо сесію на кожному кроці
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
      
      // ВИПРАВЛЕНО: правильне збереження імені
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
      
      console.log(`[auth] 🏁 Завершення реєстрації для ${ctx.from.id}:`, {
        name: ctx.session.temp.name,
        email: ctx.session.temp.email,
        phone: ctx.session.temp.phone,
        timezone
      });
      
      // ВИПРАВЛЕНО: створюємо користувача з обробкою помилок
      try {
        const user = await userService.createUser({
          tgId: ctx.from.id,
          name: ctx.session.temp.name,
          email: ctx.session.temp.email,
          phone: ctx.session.temp.phone,
          timezone
        });

        // Очищаємо сесію після створення користувача
        ctx.session = {};

        console.log(`[auth] ✅ Користувача створено успішно:`, user);

        const welcomeMessage = `🎉 Реєстрацію завершено!\n\nТвій часовий пояс: ${selectedTimezone}`;
        await ctx.reply(welcomeMessage, keyboards.removeKeyboard());

        const hasActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
        
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
        console.error('[auth] ❌ Помилка створення користувача:', createError);
        
        ctx.session = {};
        
        await ctx.reply(
          '❌ Помилка створення акаунта. Можливо проблема з базою даних.\n\n' + 
          'Спробуйте ще раз через хвилину або зв\'яжіться з підтримкою:\nnadyastarway@gmail.com'
        );
        
        return true;
      }
    }
    
  } catch (error) {
    console.error('[handleRegistrationStep] Помилка:', error);
    await ctx.reply('❌ Помилка реєстрації. Спробуйте /start');
    ctx.session = {}; 
  }

  return false;
}