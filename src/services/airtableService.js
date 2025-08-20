import { tables } from '../config/database.js';

// Generic methods
const create = async (tableName, data) => {
  try {
    const records = await tables[tableName].create([{ fields: data }]);
    return records[0];
  } catch (error) {
    console.error(`Error creating record in ${tableName}:`, error);
    throw error;
  }
};

const findByField = async (tableName, fieldName, value) => {
  try {
    const records = await tables[tableName]
      .select({
        filterByFormula: `{${fieldName}} = "${value}"`
      })
      .firstPage();
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error(`Error finding record in ${tableName}:`, error);
    throw error;
  }
};

const update = async (tableName, recordId, data) => {
  try {
    const records = await tables[tableName].update([
      { id: recordId, fields: data }
    ]);
    return records[0];
  } catch (error) {
    console.error(`Error updating record in ${tableName}:`, error);
    throw error;
  }
};

const getAll = async (tableName, options = {}) => {
  try {
    const records = await tables[tableName].select(options).all();
    return records;
  } catch (error) {
    console.error(`Error getting records from ${tableName}:`, error);
    throw error;
  }
};

// User-specific methods
const createUser = async (userData) => {
  return create('users', {
    'User Name': userData.name,
    'UserRegistered': userData.registered || false,
    'DateUserRegistered': userData.dateRegistered || new Date().toISOString(),
    'TG_id': userData.telegramId.toString(),
    'Email': userData.email || '',
    'Phone': userData.phone || '',
    'Time Zone': userData.timezone || 'Europe/Kiev',
    'Status': userData.status || 'New User',
    'Subscription Status': userData.subscriptionStatus || 'Empty',
    'Active Subscription Plan': userData.activePlan || ''
  });
};

const getUserByTelegramId = async (telegramId) => {
  return findByField('users', 'TG_id', telegramId.toString());
};

const updateUser = async (recordId, userData) => {
  return update('users', recordId, userData);
};

// Subscription methods
const createSubscription = async (subscriptionData) => {
  return create('subscriptions', {
    'UserName': subscriptionData.userName,
    'UserPhone': subscriptionData.userPhone || '',
    'User_Email': subscriptionData.userEmail || '',
    'TG_id': subscriptionData.telegramId.toString(),
    'Plan_Name': subscriptionData.planName,
    'Order_Reference': subscriptionData.orderReference,
    'Payment_Status': subscriptionData.paymentStatus || 'Pending',
    'Status': subscriptionData.status || 'Pending',
    'Plan_Type': subscriptionData.planType,
    'Created_Date': new Date().toISOString(),
    'Start_Date': subscriptionData.startDate,
    'End_Date': subscriptionData.endDate,
    'Amount': subscriptionData.amount
  });
};

// Reflection methods
const createReflection = async (reflectionData) => {
  return create('userReflections', {
    'Reminder Key': reflectionData.reminderKey,
    'User Name': reflectionData.userName,
    'User ID': reflectionData.userId,
    'Record DateTime': reflectionData.recordDateTime || new Date().toISOString(),
    'Day of Week': reflectionData.dayOfWeek,
    'Question Type': reflectionData.questionType,
    'User Response': reflectionData.userResponse || '',
    'State': reflectionData.state || '',
    'Goal': reflectionData.goal || '',
    'Energy Gain': reflectionData.energyGain || '',
    'Programs': reflectionData.programs || '',
    'Energy Loss': reflectionData.energyLoss || '',
    'Victory': reflectionData.victory || '',
    'Summary': reflectionData.summary || ''
  });
};

const createMorningResponse = async (responseData) => {
  return create('morningResponses', {
    'Reminder Key Morning': responseData.reminderKey,
    'user_id': responseData.userId,
    'user_name': responseData.userName,
    'date': responseData.date,
    'question_1': responseData.question1 || '',
    'question_2': responseData.question2 || '',
    'question_3': responseData.question3 || '',
    'question_4': responseData.question4 || '',
    'question_5': responseData.question5 || '',
    'question_6': responseData.question6 || ''
  });
};

const createEveningResponse = async (responseData) => {
  return create('eveningResponses', {
    'Reminder Key Evening': responseData.reminderKey,
    'user_id': responseData.userId,
    'user_name': responseData.userName,
    'date': responseData.date,
    'question_1': responseData.question1 || '',
    'question_2': responseData.question2 || '',
    'question_3': responseData.question3 || '',
    'question_4': responseData.question4 || '',
    'question_5': responseData.question5 || ''
  });
};

// Affirmation methods
const getRandomAffirmation = async (category = null) => {
  try {
    const options = {
      filterByFormula: category ? `{Category} = "${category}"` : '{Used} = FALSE()'
    };
    
    const records = await getAll('affirmations', options);
    
    if (records.length === 0) {
      // Reset all affirmations if none available
      await resetAffirmations();
      return getRandomAffirmation(category);
    }
    
    const randomIndex = Math.floor(Math.random() * records.length);
    const selectedRecord = records[randomIndex];
    
    // Mark as used
    await update('affirmations', selectedRecord.id, { 'Used': true });
    
    return selectedRecord.fields.Affirmation;
  } catch (error) {
    console.error('Error getting random affirmation:', error);
    return 'Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.';
  }
};

const resetAffirmations = async () => {
  try {
    const allAffirmations = await getAll('affirmations');
    const updates = allAffirmations.map(record => ({
      id: record.id,
      fields: { 'Used': false }
    }));
    
    // Update in batches of 10 (Airtable limit)
    for (let i = 0; i < updates.length; i += 10) {
      const batch = updates.slice(i, i + 10);
      await tables.affirmations.update(batch);
    }
    
    console.log('✅ Affirmations reset successfully');
  } catch (error) {
    console.error('Error resetting affirmations:', error);
  }
};

// Analytics methods
const getUserReflections = async (userId, days = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const records = await tables.userReflections
      .select({
        filterByFormula: `AND({User ID} = "${userId}", IS_AFTER({Record DateTime}, "${cutoffDate.toISOString()}"))`
      })
      .all();
      
    return records;
  } catch (error) {
    console.error('Error getting user reflections:', error);
    return [];
  }
};

const getActiveUsers = async () => {
  try {
    const records = await tables.users.select({
      filterByFormula: 'AND({Status} = "Active User", FIND("✅ Активна", {Subscription Status}))'
    }).all();
    return records.map(record => record.fields);
  } catch (error) {
    console.error('Error getting active users:', error);
    return [];
  }
};

export default {
  create,
  findByField,
  update,
  getAll,
  createUser,
  getUserByTelegramId,
  updateUser,
  createSubscription,
  createReflection,
  createMorningResponse,
  createEveningResponse,
  getRandomAffirmation,
  resetAffirmations,
  getUserReflections,
  getActiveUsers
};