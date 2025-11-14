// src/features/registration/handlers.js
import * as authService from '../../core/auth/service.js';
import * as gamification from '../../core/gamification/engine.js';
import { updateUserFields, updateUserStep } from '../../services/users.js';
import { isValidName, isValidEmail, isValidPhone } from '../../utils/validators.js';
import { REGISTRATION_STEPS, MESSAGES } from './constants.js';
import keyboards from '../../utils/keyboards.js';

export const handleStart = async (ctx) => {
  const { user } = ctx.state;
  
  if (authService.isRegistered(user)) {
    return ctx.reply('Ти вже зареєстрований! 🎉', keyboards.mainMenu());
  }
  
  const step = authService.getRegistrationStep(user);
  
  if (step !== REGISTRATION_STEPS.START) {
    return continueRegistration(ctx);
  }
  
  await updateUserStep(user.fields.TG_id, REGISTRATION_STEPS.NAME_CHOICE);
  
  await ctx.reply(
    MESSAGES.WELCOME(ctx.from.first_name),
    keyboards.nameOptions(ctx.from.first_name)
  );
};

const continueRegistration = async (ctx) => {
  const { user } = ctx.state;
  const step = authService.getRegistrationStep(user);
  
  const steps = {
    [REGISTRATION_STEPS.NAME_CHOICE]: () => 
      ctx.reply('Як тебе звати?', keyboards.nameOptions(ctx.from.first_name)),
    
    [REGISTRATION_STEPS.NAME_INPUT]: () => 
      ctx.reply('Введи імʼя (2-50 символів):'),
    
    [REGISTRATION_STEPS.EMAIL]: () => 
      ctx.reply('Введи email:', keyboards.skipEmail()),
    
    [REGISTRATION_STEPS.PHONE]: () => 
      ctx.reply('Введи телефон:', keyboards.skipPhone())
  };
  
  await steps[step]?.();
};

export const handleUseTelegramName = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.state.user.fields.TG_id;
  const name = ctx.from.first_name || 'Користувач';
  
  await updateUserFields(tgId, { 'User Name': name });
  await updateUserStep(tgId, REGISTRATION_STEPS.EMAIL);
  
  await ctx.reply(MESSAGES.NAME_SAVED(name), keyboards.skipEmail());
};

export const handleEnterCustomName = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.state.user.fields.TG_id;
  
  await updateUserStep(tgId, REGISTRATION_STEPS.NAME_INPUT);
  await ctx.reply('Введи імʼя (2-50 символів):');
};

export const handleNameInput = async (ctx, text) => {
  if (!isValidName(text)) {
    return ctx.reply('Імʼя: 2-50 символів. Спробуй ще:');
  }
  
  const tgId = ctx.state.user.fields.TG_id;
  
  await updateUserFields(tgId, { 'User Name': text });
  await updateUserStep(tgId, REGISTRATION_STEPS.EMAIL);
  
  await ctx.reply(MESSAGES.NAME_SAVED(text), keyboards.skipEmail());
};

export const handleEmailInput = async (ctx, text) => {
  if (!isValidEmail(text)) {
    return ctx.reply('Невірний email. Спробуй ще:', keyboards.skipEmail());
  }
  
  const tgId = ctx.state.user.fields.TG_id;
  
  await updateUserFields(tgId, { Email: text });
  await updateUserStep(tgId, REGISTRATION_STEPS.PHONE);
  
  await ctx.reply(MESSAGES.EMAIL_SAVED, keyboards.skipPhone());
};

export const handleSkipEmail = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.state.user.fields.TG_id;
  
  await updateUserStep(tgId, REGISTRATION_STEPS.PHONE);
  await ctx.reply('Email пропущено.\n\nТелефон:', keyboards.skipPhone());
};

export const handlePhoneInput = async (ctx, text) => {
  if (!isValidPhone(text)) {
    return ctx.reply('Невірний телефон. Спробуй ще:', keyboards.skipPhone());
  }
  
  const tgId = ctx.state.user.fields.TG_id;
  
  await completeRegistrationFlow(ctx, tgId, text);
};

export const handleSkipPhone = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.state.user.fields.TG_id;
  
  await completeRegistrationFlow(ctx, tgId, null);
};

const completeRegistrationFlow = async (ctx, tgId, phone) => {
  const user = ctx.state.user;
  
  await authService.completeRegistration(tgId, {
    name: user.fields['User Name'],
    email: user.fields.Email,
    phone
  });
  
  await gamification.rewardRegistration(tgId);
  await gamification.checkAndAwardBadge(tgId, 'beginner', ctx._bot);
  
  await ctx.reply(MESSAGES.COMPLETED, keyboards.mainMenu());
};

export const handleTextInput = async (ctx) => {
  const { user } = ctx.state;
  const step = authService.getRegistrationStep(user);
  const text = ctx.message.text.trim();
  
  const handlers = {
    [REGISTRATION_STEPS.NAME_INPUT]: () => handleNameInput(ctx, text),
    [REGISTRATION_STEPS.EMAIL]: () => handleEmailInput(ctx, text),
    [REGISTRATION_STEPS.PHONE]: () => handlePhoneInput(ctx, text)
  };
  
  await handlers[step]?.();
};