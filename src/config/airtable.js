// config/airtable.js
import Airtable from 'airtable';

Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY
});

export const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Table references
export const tables = {
  users: base('Users'),
  subscriptions: base('Subscriptions'), 
  userReflections: base('User Reflections'),
  morningResponses: base('Morning_Responses'),
  eveningResponses: base('Evening_Responses'),
  affirmations: base('Affirmations')
};