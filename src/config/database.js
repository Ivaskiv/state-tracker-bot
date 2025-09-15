// src/config/database.js - ДОДАНО НОВІ ТАБЛИЦІ
import Airtable from "airtable";
import dotenv from "dotenv";
dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

export const getBase = () => new Airtable({ 
  apiKey: process.env.AIRTABLE_API_KEY 
}).base(process.env.AIRTABLE_BASE_ID);

export const tables = Object.freeze({
  USERS: 'Users',
  SUBSCRIPTIONS: 'Subscriptions',
  RESPONSES: 'Responses',
  USER_REFLECTIONS: 'User Reflections',
  AFFIRMATIONS: 'Affirmations',
  USER_AFFIRMATIONS: 'User Affirmations',
  USER_REPORTS: 'User Reports',
  USER_GOALS: 'User_Goals',
  DAILY_MICRO_ACTIONS: 'Daily_Micro_Actions', 
  WHEEL_BALANCE: 'WheelBalance', 
  AI_CONVERSATIONS: 'AI_Conversations'
});

export const selectFromTable = (tableName, opts = {}) => base(tables[tableName] || tableName).select(opts);
export const createRows = (tableName, rows) => base(tables[tableName] || tableName).create(rows, { typecast: true });
export const updateRows = (tableName, rows) => base(tables[tableName] || tableName).update(rows, { typecast: true });