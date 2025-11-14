// src/features/registration/handlers.js
import { updateUserStep, updateUserFields, finalizeRegistration } from '../../services/users.js';
import { isValidName, isValidEmail, isValidPhone } from '../../utils/validators.js';
import keyboards from '../../utils/keyboards.js';

export const startHandler = async (ctx) => {
  const { user, isOnboarded, step } = ctx.state;
  
  // Вже зареєстрований
  if (isOnboarded) {
    return ctx.reply('Привіт! 👋', keyboards.mainMenu());
  }
  
  // Продовжуємо онбординг
  if (step !== 'idle') {
    return continueOnboarding(ctx);
  }
  
  // Новий онбординг
  const tgId = user.fields.TG_id;
  await updateUserStep(tgId, 'ob_name');
  await ctx.reply(
    'Привіт! Як тебе звати?',
    keyboards.nameOptions(ctx.from.first_name)
  );
};

const continueOnboarding = async (ctx) => {
  const { step } = ctx.state;
  const tgName = ctx.from.first_name;
  
  const steps = {
    ob_name: () => ctx.reply('Як тебе звати?', keyboards.nameOptions(tgName)),
    ob_name_input: () => ctx.reply('Введи імʼя (2-50 символів):'),
    ob_email: () => ctx.reply('Введи email:', keyboards.skipEmail()),
    ob_phone: () => ctx.reply('Введи телефон:', keyboards.skipPhone()),
  };
  
  await steps[step]?.();
};

export const nameActions = {
  use_telegram_name: async (ctx) => {
    await ctx.answerCbQuery();
    const tgId = ctx.state.user.fields.TG_id;
    const name = ctx.from.first_name || 'Користувач';
    
    await updateUserFields(tgId, { 'User Name': name });
    await updateUserStep(tgId, 'ob_email');
    await ctx.reply(`Записала: "${name}". Email:`, keyboards.skipEmail());
  },
  
  enter_custom_name: async (ctx) => {
    await ctx.answerCbQuery();
    const tgId = ctx.state.user.fields.TG_id;
    await updateUserStep(tgId, 'ob_name_input');
    await ctx.reply('Введи імʼя (2-50 символів):');
  },
  
  skip_email: async (ctx) => {
    await ctx.answerCbQuery();
    const tgId = ctx.state.user.fields.TG_id;
    await updateUserStep(tgId, 'ob_phone');
    await ctx.reply('Email пропущено. Телефон:', keyboards.skipPhone());
  },
  
  skip_phone: async (ctx) => {
    await ctx.answerCbQuery();
    const tgId = ctx.state.user.fields.TG_id;
    
    await finalizeRegistration(tgId, {
      name: ctx.state.user.fields['User Name'],
      email: ctx.state.user.fields.Email,
      phone: null,
    });
    
    await ctx.reply('✅ Реєстрація завершена!', keyboards.mainMenu());
  }
};

export const textHandler = async (ctx) => {
  const { user, step } = ctx.state;
  const text = ctx.message.text.trim();
  const tgId = user.fields.TG_id;
  
  const handlers = {
    ob_name_input: async () => {
      if (!isValidName(text)) {
        return ctx.reply('Імʼя: 2-50 символів. Спробуй ще:');
      }
      await updateUserFields(tgId, { 'User Name': text });
      await updateUserStep(tgId, 'ob_email');
      await ctx.reply(`Чудово, ${text}! Email:`, keyboards.skipEmail());
    },
    
    ob_email: async () => {
      if (!isValidEmail(text)) {
        return ctx.reply('Невірний email. Спробуй ще:', keyboards.skipEmail());
      }
      await updateUserFields(tgId, { Email: text });
      await updateUserStep(tgId, 'ob_phone');
      await ctx.reply('Email збережено! Телефон:', keyboards.skipPhone());
    },
    
    ob_phone: async () => {
      if (!isValidPhone(text)) {
        return ctx.reply('Невірний телефон. Спробуй ще:', keyboards.skipPhone());
      }
      
      await finalizeRegistration(tgId, {
        name: user.fields['User Name'],
        email: user.fields.Email,
        phone: text,
      });
      
      await ctx.reply('✅ Реєстрація завершена!', keyboards.mainMenu());
    }
  };
  
  await handlers[step]?.();
};