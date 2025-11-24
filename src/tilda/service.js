// src/tilda/service.js

import crypto from 'crypto';
// import { TILDA_CONFIG, CONTENT_MAP } from './constants.js';
import { getUserByTgId, hasActiveAccess, updateUserFields } from '../services/users.js';
import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';
import { TILDA_CONFIG } from './config.js';
import { CONTENT_MAP } from './constants.js';

const base = getBase();

export const generateTildaToken = (userId, email, accessLevel, userName = '') => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      user_id: String(userId),
      email: email || `user${userId}@starway.bot`,
      name: userName || 'Користувач',
      access_level: accessLevel,
      iat: now,
      exp: now + (TILDA_CONFIG.JWT_EXPIRY_DAYS * 24 * 60 * 60)
    };
    
    const header = { alg: TILDA_CONFIG.JWT_ALGORITHM, typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', TILDA_CONFIG.SECRET_KEY)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  } catch (error) {
    logger.error('[Tilda Service] ❌ Token generation failed:', error);
    throw new Error('Failed to generate token');
  }
};

export const getUserAccessLevel = async (tgId) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) return TILDA_CONFIG.ACCESS_LEVELS.FREE;
    
    const fields = user.fields;
    const plan = String(fields['Active_Subscription_Plan'] || '');
    const status = String(fields['Subscription_Status'] || '').toLowerCase();
    const endDate = fields.End_Date;
    
    if (endDate && new Date(endDate) < new Date()) {
      return TILDA_CONFIG.ACCESS_LEVELS.EXPIRED;
    }
    
    if (status === 'active' && !plan.includes('Пробний') && hasActiveAccess(user)) {
      return TILDA_CONFIG.ACCESS_LEVELS.PAID;
    }
    
    if (plan.includes('Пробний') && hasActiveAccess(user)) {
      return TILDA_CONFIG.ACCESS_LEVELS.TRIAL;
    }
    
    return TILDA_CONFIG.ACCESS_LEVELS.FREE;
  } catch (error) {
    logger.error('[Tilda Service] ❌ getUserAccessLevel:', error);
    return TILDA_CONFIG.ACCESS_LEVELS.FREE;
  }
};

export const getMemberAreaUrl = async (tgId) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) throw new Error('User not found');
    
    const accessLevel = await getUserAccessLevel(tgId);
    const token = generateTildaToken(
      tgId,
      user.fields.Email,
      accessLevel,
      user.fields['User_Name']
    );
    
    await updateUserFields(tgId, {
      Tilda_Last_Access: new Date().toISOString()
    });
    
    return `${TILDA_CONFIG.MEMBER_AREA_URL}?token=${token}`;
  } catch (error) {
    logger.error('[Tilda Service] ❌ getMemberAreaUrl:', error);
    throw error;
  }
};

export const getAvailableContent = (accessLevel) => {
  return CONTENT_MAP[accessLevel] || CONTENT_MAP.free;
};

export const handleTildaFormSubmit = async (formData) => {
  try {
    const { Email, Name, Phone, TG_ID } = formData;
    
    if (!TG_ID) {
      return { success: false, error: 'Missing TG_ID' };
    }
    
    const updates = { Tilda_Registered: true };
    if (Email) updates.Email = Email;
    if (Name) updates['User_Name'] = Name;
    if (Phone) updates.Phone = Phone;
    
    await updateUserFields(TG_ID, updates);
    return { success: true };
  } catch (error) {
    logger.error('[Tilda Service] ❌ handleTildaFormSubmit:', error);
    return { success: false, error: error.message };
  }
};

export default {
  generateTildaToken,
  getUserAccessLevel,
  getMemberAreaUrl,
  getAvailableContent,
  handleTildaFormSubmit
};

console.log('✅ [Tilda Service] Завантажено');