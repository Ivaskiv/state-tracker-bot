// services/airtableService.js
import { tables } from '../config/airtable.js';
import moment from 'moment-timezone';

export class AirtableService {
  
  // Створити користувача
  static async createUser(userData) {
    try {
      const record = await tables.users.create({
        'User Name': userData.name,
        'TG_id': userData.telegramId.toString(),
        'Email': userData.email || '',
        'Phone': userData.phone || '',
        'Time Zone': userData.timezone || 'Europe/Kiev',
        'Status': 'New User',
        'UserRegistered': false,
        'DateUserRegistered': moment().format('YYYY-MM-DD'),
        'Subscription Status': 'New'
      });
      
      return record;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Отримати користувача по Telegram ID
  static async getUserByTelegramId(telegramId) {
    try {
      const records = await tables.users.select({
        filterByFormula: `{TG_id} = '${telegramId}'`
      }).firstPage();
      
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  // Оновити користувача
  static async updateUser(recordId, updateData) {
    try {
      return await tables.users.update(recordId, updateData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Створити підписку
  static async createSubscription(subscriptionData) {
    try {
      const record = await tables.subscriptions.create({
        'User_ID': subscriptionData.userId,
        'UserName': subscriptionData.userName,
        'UserPhone': subscriptionData.userPhone || '',
        'User_Email': subscriptionData.userEmail || '',
        'TG_id': subscriptionData.telegramId.toString(),
        'Plan_Name': subscriptionData.planName,
        'Plan_Type': subscriptionData.planType,
        'Status': 'Active',
        'Payment_Status': 'Paid',
        'Created_Date': moment().format('YYYY-MM-DD'),
        'Start_Date': moment().format('YYYY-MM-DD'),
        'End_Date': moment().add(subscriptionData.duration, 'days').format('YYYY-MM-DD'),
        'Amount': subscriptionData.amount
      });
      
      return record;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Зберегти ранкові відповіді
  static async saveMorningResponse(responseData) {
    try {
      const reminderKey = `${responseData.userName}_${responseData.telegramId}_${moment().format('DDMMYYYY')}_Morning`;
      
      const record = await tables.morningResponses.create({
        'Reminder Key Morning': reminderKey,
        'user_id': responseData.userId,
        'user_name': responseData.userName,
        'date': moment().format('YYYY-MM-DD'),
        'question_1': responseData.question1 || '',
        'question_2': responseData.question2 || '',
        'question_3': responseData.question3 || '',
        'question_4': responseData.question4 || '',
        'question_5': responseData.question5 || '',
        'question_6': responseData.question6 || ''
      });
      
      return record;
    } catch (error) {
      console.error('Error saving morning response:', error);
      throw error;
    }
  }

  // Зберегти вечірні відповіді
  static async saveEveningResponse(responseData) {
    try {
      const reminderKey = `${responseData.userName}_${responseData.telegramId}_${moment().format('DDMMYYYY')}_Evening`;
      
      const record = await tables.eveningResponses.create({
        'Reminder Key Evening': reminderKey,
        'user_id': responseData.userId,
        'user_name': responseData.userName,
        'date': moment().format('YYYY-MM-DD'),
        'question_1': responseData.question1 || '',
        'question_2': responseData.question2 || '',
        'question_3': responseData.question3 || '',
        'question_4': responseData.question4 || '',
        'question_5': responseData.question5 || ''
      });
      
      return record;
    } catch (error) {
      console.error('Error saving evening response:', error);
      throw error;
    }
  }

  // Зберегти рефлексію з AI аналітикою
  static async saveUserReflection(reflectionData) {
    try {
      const reminderKey = `${reflectionData.userName}_${reflectionData.telegramId}_${moment().format('DDMMYYYY')}_${reflectionData.questionType}`;
      
      const record = await tables.userReflections.create({
        'Reminder Key': reminderKey,
        'User Name': reflectionData.userName,
        'User ID': reflectionData.userId,
        'Record DateTime': moment().format('YYYY-MM-DD HH:mm:ss'),
        'Day of Week': moment().format('dddd'),
        'Question Type': reflectionData.questionType,
        'User Response': reflectionData.userResponse || '',
        'State': reflectionData.state || '',
        'Goal': reflectionData.goal || '',
        'Energy Gain': reflectionData.energyGain || '',
        'Programs': reflectionData.programs || '',
        'Energy Loss': reflectionData.energyLoss || '',
        'Victory': reflectionData.victory || '',
        'AI Analytics': reflectionData.aiAnalytics || '',
        'Affirmation': reflectionData.affirmation || ''
      });
      
      return record;
    } catch (error) {
      console.error('Error saving user reflection:', error);
      throw error;
    }
  }

  // Отримати активні підписки
  static async getActiveUsers() {
    try {
      const records = await tables.users.select({
        filterByFormula: "AND({Sent Reminder Now (Morning/Evening)}, {Active_Subscription_Status} != '')"
      }).all();
      
      return records;
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  // Отримати дані для аналітики
  static async getUserReflectionsForAnalysis(userId, days = 7) {
    try {
      const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');
      
      const records = await tables.userReflections.select({
        filterByFormula: `AND({User ID} = '${userId}', IS_AFTER({Record DateTime}, '${startDate}'))`,
        sort: [{ field: 'Record DateTime', direction: 'desc' }]
      }).all();
      
      return records;
    } catch (error) {
      console.error('Error getting user reflections:', error);
      return [];
    }
  }

  // Зберегти афірмацію
  static async createAffirmation(affirmationText, category = 'Особистий розвиток') {
    try {
      const record = await tables.affirmations.create({
        'Affirmation': affirmationText,
        'Date Created': moment().format('YYYY-MM-DD'),
        'Week day': moment().format('dddd'),
        'Used': false,
        'Category': category
      });
      
      return record;
    } catch (error) {
      console.error('Error creating affirmation:', error);
      throw error;
    }
  }

  // Отримати випадкову афірмацію
  static async getRandomAffirmation() {
    try {
      const records = await tables.affirmations.select({
        filterByFormula: "{Used} = FALSE()"
      }).all();
      
      if (records.length > 0) {
        const randomRecord = records[Math.floor(Math.random() * records.length)];
        
        // Позначити як використану
        await tables.affirmations.update(randomRecord.id, { 'Used': true });
        
        return randomRecord.get('Affirmation');
      }
      
      return "Твоя сила — всередині тебе. Довіряй собі і йди до мети.";
    } catch (error) {
      console.error('Error getting random affirmation:', error);
      return "Ти можеш більше, ніж думаєш. Вір у себе.";
    }
  }
}