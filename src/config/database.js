// src/config/database.js - ЧЕРЕЗ FETCH

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('❌ Відсутні credentials');
  process.exit(1);
}

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

export const tables = Object.freeze({
  USERS: 'Users',
  SUBSCRIPTIONS: 'Subscriptions',
  RESPONSES: 'Responses',
  WHEEL_BALANCE: 'WheelBalance',
  AI_CONVERSATIONS: 'AI_Conversations'
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const request = async (method, tableName, options = {}) => {
  const table = tables[tableName] || tableName;
  let url = `${BASE_URL}/${encodeURIComponent(table)}`;
  
  if (options.recordId) {
    url += `/${options.recordId}`;
  }
  
  if (options.params) {
    const params = new URLSearchParams(options.params);
    url += `?${params}`;
  }

  console.log(`[database] ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30000) // 30 секунд timeout
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${error.error?.message || response.statusText}`);
  }

  return await response.json();
};

// ===== SELECT ONE =====
export const selectOne = async (tableName, filter) => {
  console.log(`[database] selectOne: ${tableName}, filter="${filter}"`);
  
  const data = await request('GET', tableName, {
    params: {
      filterByFormula: filter,
      maxRecords: '1'
    }
  });

  console.log(`[database] Знайдено: ${data.records.length}`);
  
  return data.records[0] || null;
};

// ===== CREATE =====
export const createRecord = async (tableName, fields) => {
  console.log(`[database] createRecord: ${tableName}`);
  
  const data = await request('POST', tableName, {
    body: {
      fields,
      typecast: true
    }
  });

  console.log(`[database] Створено: ${data.id}`);
  
  return data;
};

// ===== UPDATE =====
export const updateRecord = async (tableName, recordId, fields) => {
  console.log(`[database] updateRecord: ${tableName}/${recordId}`);
  
  const data = await request('PATCH', tableName, {
    recordId,
    body: {
      fields,
      typecast: true
    }
  });

  console.log(`[database] Оновлено`);
  
  return data;
};

// ===== FIND =====
export const findRecords = async (tableName, options = {}) => {
  console.log(`[database] findRecords: ${tableName}`);
  
  const data = await request('GET', tableName, {
    params: options
  });

  console.log(`[database] Знайдено: ${data.records.length}`);
  
  return data.records;
};

// Не потрібно для HTTP
export const getBase = () => null;

console.log('✅ [database] HTTP client готовий');