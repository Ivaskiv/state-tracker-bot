// src/features/registration/service.js

import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const getRegistrationData = async (tgId) => {
  try {
    const users = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: [
          'User_Name',
          'Email', 
          'Phone',
          'Time_Zone',
          'End_Date',
          'Answer_Step',
          'User_Registered',
          'Status',
          'Subscription_Status'
        ]
      })
      .firstPage();

    if (!users.length) return null;
    
    const userData = users[0].fields;
    
    console.log('📊 [getRegistrationData]', {
      tgId,
      exists: true,
      registered: userData.User_Registered,
      step: userData.Answer_Step,
      status: userData.Status
    });
    
    return userData;
  } catch (error) {
    logger.error('[registration/service] getRegistrationData:', error);
    return null;
  }
};

export const isUser_Registered = (userData) => {
  return !!userData && userData.User_Registered === true && !/^ob_/i.test(userData.Answer_Step || '');
};

export const getOnboardingStep = (userData) => {
  return userData?.Answer_Step || 'ob_name';
};

export const updateUserStep = async (tgId, step) => {
  try {
    await base('Users').update([
      {
        id: tgId,
        fields: {
          Answer_Step: step
        }
      }
    ]);
  } catch (error) {
    logger.error('[registration/service] updateUserStep:', error);
  }
}

export const sendWelcomeEmail = async (email, userName) => {
  logger.info(`[registration/service] welcome email -> ${email} (${userName})`);
};
