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

export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  try {
    const user = await userService.getUserByTelegramId(tgId);

    if (!user) {
      // Нова реєстрація - ВИПРАВЛЕНО: правильна ініціалізація сесії
      if (!ctx.session) ctx.session = {};
      ctx.session.step = 'reg_name';
      ctx.session.temp = { name };
      
      console.log(`[auth] 🆕 Нова реєстрація для ${tgId}, ім'я: ${name}`);
      
      await ctx.reply(`🌟 Вітаю в aiMentor, ${name}!\n\nПочнемо реєстрацію. Підтверди своє ім'я або введи інше:`, keyboards.skipKeyboard());
      return;
    }

    // Існуючий користувач
    const hasActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
    
    if (hasActiveSubscription) {
      await ctx.reply(`Привіт знову, ${name}! 👋\n\nГотовий продовжити трансформацію?`, keyboards.mainMenuKeyboard());
    } else {
      await ctx.reply(
        `Привіт, ${name}! 👋\n\n❌ Твоя підписка неактивна.\n\nДля користування всіма функціями потрібна активна підписка.\n\n📞 Зв'яжіться з підтримкою: nadyastarway@gmail.com`,
        keyboards.subscriptionKeyboard()
      );
    }
  } catch (error) {
    console.error('[handleStart] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуйте ще раз.');
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

        // Перевіряємо підписку
        const hasActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
        
        if (hasActiveSubscription) {
          // Запускаємо колесо балансу для активних користувачів
          await ctx.reply('🎯 Почнемо з оцінки твого життєвого балансу!');
          await wheelBalanceController.handleWheelBalanceRequest(ctx);
        } else {
          // Пропонуємо підписку
          await ctx.reply(
            '💰 Для початку роботи потрібна активна підписка.\n\n📞 Зв\'яжіся з підтримкою для оформлення:\nnadyastarway@gmail.com',
            keyboards.subscriptionKeyboard()
          );
        }
        
        return true;
        
      } catch (createError) {
        console.error('[auth] ❌ Помилка створення користувача:', createError);
        
        // Очищаємо сесію при помилці
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
    ctx.session = {}; // Очищаємо сесію при помилці
  }

  return false;
}