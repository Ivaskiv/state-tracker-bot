// src/modules/auth.js
import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';

export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const user = await userService.getUserByTelegramId(tgId);

  await typing(ctx);
  if (!user) {
    ctx.session = ctx.session || {};
    ctx.session.step = 'reg_name';
    ctx.session.temp = {};
    return ctx.reply('🌟 Вітаю в AI-Coach! Як тебе звати?', keyboards.skipKeyboard());
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
      await ctx.reply('Введи ім’я або натисни «Пропустити».', keyboards.skipKeyboard());
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

    const tgId = ctx.from.id;
    const user = await userService.createUser({
      tgId,
      name: ctx.session?.temp?.name || 'Користувач',
      email: ctx.session?.temp?.email || null,
      phone: isSkip(text) ? null : text
    });

    // очищаємо сесію реєстрації
    ctx.session.step = null;
    ctx.session.temp = {};

    // Перевіряємо активну підписку
    const hasActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (!hasActiveSubscription) {
      const welcomeMessage = `🎉 Реєстрація завершена!\n\n💰 Для початку роботи потрібна активна підписка.\nОбери план у меню "💰 Підписка"`;
      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
      return true;
    }

    await ctx.reply(profileMessage(user), keyboards.mainMenuKeyboard());
    return true;
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
  return `📊 ПРОФІЛЬ\n\n👤 Ім'я: ${name}\n🆔 ID: ${tg}\n\n📦 ПІДПИСКА:\n${
    active.includes('✅')
      ? `${active}\n📊 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`
      : '❌ Неактивна'
  }`;
}
