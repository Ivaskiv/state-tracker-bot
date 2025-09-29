// test-airtable.js - З TIMEOUT
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config();

Airtable.configure({ 
  apiKey: process.env.AIRTABLE_API_KEY,
  requestTimeout: 60000 // 60 секунд
});

const base = new Airtable().base(process.env.AIRTABLE_BASE_ID);

console.log('Чекаю 60 секунд...');

base('Users')
  .select({ maxRecords: 1 })
  .firstPage()
  .then(records => {
    console.log('✅ ПРАЦЮЄ! Записів:', records.length);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Помилка:', error.message);
    process.exit(1);
  });