// src/utils/airtable.js
import Airtable from 'airtable';
import { config } from '../config/config.js';

const base = new Airtable({ 
  apiKey: config.airtableApiKey 
}).base(config.airtableBaseId);

// ===== HELPER FUNCTIONS =====
const formatDate = (date = new Date()) => date.toISOString().split('T')[0];
const formatDateTime = (date = new Date()) => date.toISOString();

const generateReminderKey = (userName, tgId, type, date = new Date()) => {
  const dateStr = formatDate(date).replace(/-/g, '');
  return `${userName}_${tgId}_${dateStr}_${type}`;
};

// ===== USER MANAGEMENT =====
export const getUserByTgId = async (tgId) => {
  try {
    const records = await base(config.tables.users)
      .select({ 
        filterByFormula: `{TG_id}='${tgId}'`, 
        maxRecords: 1 
      })
      .firstPage();
    return records?.[0] || null;
  } catch (error) {
    console.error('Error getting user by TG ID:', error);
    return null;
  }
};

export const createUser = async (fields) => {
  try {
    const records = await base(config.tables.users).create([{ fields }]);
    const user = records[0];

    // Створюємо початкові записи для сьогоднішньої дати
    const today = formatDate();
    await Promise.all([
      createMorningResponse({ 
        user_id: fields.TG_id, 
        user_name: fields['User Name'], 
        date: today 
      }),
      createEveningResponse({ 
        user_id: fields.TG_id, 
        user_name: fields['User Name'], 
        date: today 
      })
    ]);

    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (tgId, fields) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) throw new Error(`User not found: ${tgId}`);
    
    const records = await base(config.tables.users).update([{ 
      id: user.id, 
      fields 
    }]);
    return records[0];
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const getActiveUsers = async () => {
  try {
    return await base(config.tables.users)
      .select({ 
        filterByFormula: `{Status}='Active User'` 
      })
      .all();
  } catch (error) {
    console.error('Error getting active users:', error);
    return [];
  }
};

// ===== MORNING RESPONSES =====
export const createMorningResponse = async (fields) => {
  try {
    const records = await base(config.tables.morningResponses).create([{ fields }]);
    return records[0];
  } catch (error) {
    console.error('Error creating morning response:', error);
    throw error;
  }
};

export const getTodayMorningResponse = async (tgId) => {
  try {
    const today = formatDate();
    const records = await base(config.tables.morningResponses)
      .select({ 
        filterByFormula: `AND({user_id}='${tgId}', {date}='${today}')`, 
        maxRecords: 1 
      })
      .firstPage();
    return records?.[0] || null;
  } catch (error) {
    console.error('Error getting today morning response:', error);
    return null;
  }
};

export const updateMorningResponse = async (recordId, fields) => {
  try {
    const records = await base(config.tables.morningResponses).update([{
      id: recordId,
      fields
    }]);
    return records[0];
  } catch (error) {
    console.error('Error updating morning response:', error);
    throw error;
  }
};

// ===== EVENING RESPONSES =====
export const createEveningResponse = async (fields) => {
  try {
    const records = await base(config.tables.eveningResponses).create([{ fields }]);
    return records[0];
  } catch (error) {
    console.error('Error creating evening response:', error);
    throw error;
  }
};

export const getTodayEveningResponse = async (tgId) => {
  try {
    const today = formatDate();
    const records = await base(config.tables.eveningResponses)
      .select({ 
        filterByFormula: `AND({user_id}='${tgId}', {date}='${today}')`, 
        maxRecords: 1 
      })
      .firstPage();
    return records?.[0] || null;
  } catch (error) {
    console.error('Error getting today evening response:', error);
    return null;
  }
};

export const updateEveningResponse = async (recordId, fields) => {
  try {
    const records = await base(config.tables.eveningResponses).update([{
      id: recordId,
      fields
    }]);
    return records[0];
  } catch (error) {
    console.error('Error updating evening response:', error);
    throw error;
  }
};

// ===== USER REFLECTIONS =====
export const createUserReflection = async (fields) => {
  try {
    const records = await base(config.tables.userReflections).create([{ fields }]);
    return records[0];
  } catch (error) {
    console.error('Error creating user reflection:', error);
    throw error;
  }
};

export const getUserReflections = async (tgId, questionType = null, limit = 30) => {
  try {
    let filterFormula = `{User ID}='${tgId}'`;
    if (questionType) {
      filterFormula = `AND(${filterFormula}, {Question Type}='${questionType}')`;
    }

    const records = await base(config.tables.userReflections)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Record DateTime', direction: 'desc' }],
        maxRecords: limit
      })
      .all();
      
    return records;
  } catch (error) {
    console.error('Error getting user reflections:', error);
    return [];
  }
};

// ===== AFFIRMATIONS =====
export const getRandomAffirmation = async () => {
  try {
    const records = await base(config.tables.affirmations)
      .select({ 
        filterByFormula: `{Used} = 0`,
        maxRecords: 100
      })
      .all();
      
    if (!records.length) {
      // Якщо всі афірмації використані, скидаємо лічильник
      await base(config.tables.affirmations)
        .select({})
        .eachPage(async (records, fetchNextPage) => {
          const updates = records.map(record => ({
            id: record.id,
            fields: { Used: 0 }
          }));
          
          if (updates.length > 0) {
            await base(config.tables.affirmations).update(updates);
          }
          
          fetchNextPage();
        });
        
      return "Твоя сила — всередині тебе. Довіряй собі і йди вперед.";
    }

    const randomIndex = Math.floor(Math.random() * records.length);
    const selectedRecord = records[randomIndex];
    
    // Позначаємо афірмацію як використану
    await base(config.tables.affirmations).update([{
      id: selectedRecord.id,
      fields: { Used: 1 }
    }]);
    
    return selectedRecord.fields.Affirmation || "Не вдалося згенерувати унікальну афірмацію.";
  } catch (error) {
    console.error('Error getting random affirmation:', error);
    return "Твоя сила — всередині тебе. Довіряй собі і йди вперед.";
  }
};

// ===== SUBSCRIPTIONS =====
export const createSubscription = async (fields) => {
  try {
    const records = await base(config.tables.subscriptions).create([{ fields }]);
    return records[0];
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

export const updateSubscription = async (orderReference, fields) => {
  try {
    const records = await base(config.tables.subscriptions)
      .select({ 
        filterByFormula: `{Order_Reference}='${orderReference}'`,
        maxRecords: 1
      })
      .firstPage();
      
    if (!records.length) {
      throw new Error(`Subscription not found: ${orderReference}`);
    }
    
    const updated = await base(config.tables.subscriptions).update([{
      id: records[0].id,
      fields
    }]);
    
    return updated[0];
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
};

// ===== HELPER EXPORTS =====
export { generateReminderKey, formatDate, formatDateTime };