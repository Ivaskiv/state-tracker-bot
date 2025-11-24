// src/core/auth/service.js
import { getUserByTgId, createUser, updateUserFields } from '../../services/users.js';
import * as gamification from '../gamification/engine.js';
import { saveToAirtable } from './airtable.js';

export const authenticateUser = async (tgId, firstName, source = 'telegram') => {
  let user = await getUserByTgId(tgId);
  
  if (!user) {
    user = await createUser(tgId, firstName, {
      Status: 'New User',
      User_Registered: false,
      Answer_Step: 'registration_start',
      Attribution_Source: source
    });
    
    await gamification.initializeUser(tgId);
    await saveToAirtable(user);
  }
  
  await updateUserFields(tgId, {
    Last_Activity: new Date().toISOString()
  });
  
  return user;
};

export const completeRegistration = async (tgId, data) => {
  const user = await updateUserFields(tgId, {
    'User_Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    User_Registered: true,
    Status: 'Registered User',
    Answer_Step: 'registration_completed',
    Registration_Completed_At: new Date().toISOString()
  });
  
  await gamification.rewardRegistration(tgId);
  await saveToAirtable(user);
  
  return user;
};

export const isRegistered = (user) => {
  return user?.fields?.User_Registered === true;
};

export const getRegistrationStep = (user) => {
  return user?.fields?.Answer_Step || 'registration_start';
};