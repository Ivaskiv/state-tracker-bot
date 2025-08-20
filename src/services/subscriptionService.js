// src/services/subscriptionService.js
import base from '../config/airtable.js';
import userService from './userService.js';

const USERS = 'Users';

async function activateDemoSubscription(tgId, planName, days) {
  const user = await userService.getUserByTelegramId(tgId);
  if (!user) return null;

  const end = new Date();
  end.setDate(end.getDate() + days);

  const fields = {
    'Active Subscription Plan': planName,
    'Subscription Status': 'Active',
    'Start_Date': new Date().toISOString(),
    'End_Date': end.toISOString()
  };

  const updated = await base(USERS).update([{ id: user.id, fields }], { typecast: true });
  return updated[0];
}

export default {
  activateDemoSubscription
};
