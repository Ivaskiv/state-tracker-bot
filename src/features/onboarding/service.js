// src/features/onboarding/service.js

import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const getRegistrationData = async (tgId) => {
  try {
    const user = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: ['User Name', 'Email', 'Phone', 'Time_Zone', 'End_Date']
      })
      .firstPage();

    if (!user.length) return null;
    return user[0].fields;
  } catch (error) {
    logger.error('[onboarding/service] getUserRegistrationData:', error);
    return null;
  }
};

export const isUserRegistered = (userData) => {
  return !!userData && userData.UserRegistered === true && !/^ob_/i.test(userData.Answer_Step || '');
};

export const getOnboardingStep = (userData) => {
  return userData?.Answer_Step || 'ob_name';
};

export const sendWelcomeEmail = async (email, userName) => {
  logger.info(`[onboarding/service] welcome email -> ${email} (${userName})`);
};
