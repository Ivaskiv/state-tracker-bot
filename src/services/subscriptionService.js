// src/services/subscriptionService.js

import subscriptionRepo from '../repositories/subscriptionRepository.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

export const createTrialSubscription = async (tgId, userName) => {
  const plan = SUBSCRIPTION_PLANS.TRIAL;
  const now = new Date();
  const end = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
  
  return await subscriptionRepo.createSubscription(tgId, {
    userName,
    planName: plan.name,
    amount: 0,
    startDate: now.toISOString(),
    endDate: end.toISOString(),
    orderReference: `TRIAL_${tgId}_${Date.now()}`
  });
};

export default {
  createTrialSubscription
};