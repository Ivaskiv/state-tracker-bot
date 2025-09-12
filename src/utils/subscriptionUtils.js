// src/utils/subscriptionUtils.js
import keyboards from './keyboards.js';

export const isActiveSubscription = (user) => {
  return user['Active_Subscription_Status']?.includes('✅ Активна');
};

export const restrictAccessMessage = async (feature, ctx) => {
  await ctx.reply(`${feature} доступний тільки з активною підпискою`, keyboards.mainMenuKeyboard());
};