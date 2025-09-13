// src/auth/modules/auth.js
import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';

const TIMEZONES = [
  'Europe/Kiev (UTC+3)',
  'Europe/Warsaw (UTC+2)',
  'Europe/Berlin (UTC+2)', 
  'Europe/London (UTC+1)',
  'Europe/Paris (UTC+2)',
  'Europe/Rome (UTC+2)',
  'Europe/Vienna (UTC+2)',
  'Europe/Stockholm (UTC+2)',
  'Europe/Moscow (UTC+3)',
  'Asia/Dubai (UTC+4)',
  'America/New_York (UTC-4)',
  'America/Chicago (UTC-5)',
  'America/Los_Angeles (UTC-7)',
  'Canada/Toronto (UTC-4)',
  'Asia/Tokyo (UTC+9)',
  'Asia/Shanghai (UTC+8)',
  'Australia/Sydney (UTC+10)',
  'Europe/Prague (UTC+2)',
  'Europe/Bucharest (UTC+3)',
  'Europe/Helsinki (UTC+3)'
];

const timezoneKeyboard = () => {
  const rows = [];
  for (let i = 0; i < TIMEZONES.length; i += 2) {
    const row = [TIMEZONES[i]];
    if (TIMEZONES[i + 1]) row.push(TIMEZONES[i + 1]);
    rows.push(row);
  }
  
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
};

export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const user = await userService.getUserByTelegramId(tgId);

  await typing(ctx);
  if (!user) {
    ctx.session = ctx.session || {};
    ctx.session.step = 'reg_name';
    ctx.session.temp = {};
    return ctx.reply('🌟 Вітаю в aiMentor! Як тебе звати?', keyboards.skipKeyboard());
  }
  return ctx.reply(profileMessage(user), keyboards.mainMenuKeyboard());
}

export async function handleRegistrationStep(ctx) {
  ctx.session = ctx.session || {};
  const step = ctx.session.step;
  const text = (ctx.message?.text || '').trim();
  if (!step) return false;

  await typing(ctx);

  if (step === 'reg_name') {
    if (!text) {
      await ctx.reply('Введи ім\'я або натисни «Пропустити».', keyboards.skipKeyboard());
      return true;
    }
    ctx.session.temp = ctx.session.temp || {};
    ctx.session.temp.name = text;
    ctx.session.step = 'reg_email';
    await ctx.reply('Вкажи email або натисни «Пропустити».', keyboards.skipKeyboard());
    return true;
  }

  if (step === 'reg_email') {
    if (!isSkip(text) && text && !isValidEmail(text)) {
      await ctx.reply('Некоректний email. Спробуй ще раз або натисни «Пропустити».', keyboards.skipKeyboard());
      return true;
    }
    ctx.session.temp.email = isSkip(text) ? null : text;
    ctx.session.step = 'reg_phone';
    await ctx.reply('Вкажи номер у форматі +380XXXXXXXXX або натисни «Пропустити».', keyboards.skipKeyboard());
    return true;
  }

  if (step === 'reg_phone') {
    if (!isSkip(text) && text && !isValidUaPhone(text)) {
      await ctx.reply('Номер має бути у форматі +380XXXXXXXXX. Спробуй ще раз або натисни «Пропустити».', keyboards.skipKeyboard());
      return true;
    }
    
    ctx.session.temp.phone = isSkip(text) ? null : text;
    ctx.session.step = 'reg_timezone';
    await ctx.reply('Обери свій часовий пояс для отримання нагадувань у зручний час:', timezoneKeyboard());
    return true;
  }

if (step === 'reg_timezone') {
    const selectedTimezone = TIMEZONES.find(tz => text === tz);
    if (!selectedTimezone) {
      await ctx.reply('Обери часовий пояс зі списку:', timezoneKeyboard());
      return true;
    }

    const timezone = selectedTimezone.split(' ')[0];
    
    const tgId = ctx.from.id;
    const user = await userService.createUser({
      tgId,
      name: ctx.session?.temp?.name || 'Користувач',
      email: ctx.session?.temp?.email || null,
      phone: ctx.session?.temp?.phone || null,
      timezone: timezone
    });

    ctx.session.step = null;
    ctx.session.temp = {};

    const hasActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
    
    if (hasActiveSubscription) {
      // ✅ АВТОЗАПУСК КОЛЕСА БАЛАНСУ ПІСЛЯ РЕЄСТРАЦІЇ З АКТИВНОЮ ПІДПИСКОЮ
      const welcomeMessage = `🎉 Реєстрація завершена!\n\nТвій часовий пояс: ${selectedTimezone}\n\n🎯 Почнемо з оцінки твого життєвого балансу!`;
      await ctx.reply(welcomeMessage);
      
      // Запускаємо колесо балансу
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      return true;
    } else {
      const welcomeMessage = `🎉 Реєстрація завершена!\n\nТвій часовий пояс: ${selectedTimezone}\nРанкові питання о 8:00, вечірні о 20:30 за твоїм часом.\n\n💰 Для початку роботи потрібна активна підписка.\nОбери план у меню "💰 Підписка"`;
      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
      return true;
    }
  }
  
  return false;
}

// локальний хелпер
async function typing(ctx) {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise(res => setTimeout(res, 800));
  } catch (_) {}
}

// локальний рендер профілю
function profileMessage(user) {
  const name = user['User Name'] || 'Користувач';
  const tg = user['TG_id'] || '—';
  const active = user['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user['Active Subscription Plan'] || '—';
  const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';
  const timezone = user['Time_Zone'] || 'Europe/Prague';
  
  return `📊 ПРОФІЛЬ\n\n👤 Ім\'я: ${name}\n🆔 ID: ${tg}\n🌍 Часовий пояс: ${timezone}\n\n📦 ПІДПИСКА:\n${
    active.includes('✅')
      ? `${active}\n📊 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`
      : '❌ Неактивна'
  }`;
}