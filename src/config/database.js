import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

// Configure Airtable
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Table references
export const tables = {
  USERS: 'Users',
  SUBSCRIPTIONS: 'Subscriptions',
  USER_REFLECTIONS: 'User Reflections',
  MORNING_RESPONSES: 'Morning_Responses',
  EVENING_RESPONSES: 'Evening_Responses',
  AFFIRMATIONS: 'Affirmations'
};

// Get base instance
export const getBase = () => base;

// Test connection (опціонально)
export const testConnection = async () => {
  try {
    const records = await base(tables.USERS).select().firstPage();
    console.log('Connected to Airtable:', records.length, 'records found');
  } catch (error) {
    console.error('Error connecting to Airtable:', error);
  }
};
