// src/services/airtableClient.js
import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

// Підключення до бази Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Основна функція для роботи з таблицями
export const airtableClient = (tableName) => base(tableName);

// Додаткові функції для вибірки (необов'язково)
export const selectFromTable = (tableName, options = {}) => base(tableName).select(options);
export const findRecordById = (tableName, recordId) => base(tableName).find(recordId);
export const createRecord = (tableName, record) => base(tableName).create(record);
export const updateRecord = (tableName, recordId, fields) => base(tableName).update(recordId, fields);
export const deleteRecord = (tableName, recordId) => base(tableName).destroy(recordId);
export const listRecords = (tableName, options = {}) => base(tableName).select(options).all();
export const getRecord = (tableName, recordId) => base(tableName).find(recordId);
export const getRecords = (tableName, options = {}) => base(tableName).select(options).all();
export const createRecords = (tableName, records) => base(tableName).create(records);
export const updateRecords = (tableName, records) => base(tableName).update(records);
export const deleteRecords = (tableName, recordIds) => base(tableName).destroy(recordIds);

export default airtableClient;
