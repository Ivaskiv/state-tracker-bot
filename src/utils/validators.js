// src/utils/validators.js

import { CONFIG } from '../config/constants.js';

export const isValidName = (name) => {
  const trimmed = String(name || '').trim();
  return trimmed.length >= CONFIG.NAME_MIN_LENGTH && 
         trimmed.length <= CONFIG.NAME_MAX_LENGTH;
};

export const isValidEmail = (email) => {
  const trimmed = String(email || '').trim();
  if (!trimmed || trimmed.length > CONFIG.EMAIL_MAX_LENGTH) return false;
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(trimmed);
};

export const isValidPhone = (phone) => {
  return CONFIG.PHONE_REGEX.test(String(phone || '').trim());
};

export const formatPhone = (phone) => {
  const cleaned = String(phone || '').replace(/\D/g, '');
  
  if (cleaned.startsWith('380')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '+38' + cleaned;
  }
  if (cleaned.length === 9) {
    return '+380' + cleaned;
  }
  
  return phone;
};

export const formatEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

export const formatName = (name) => {
  return String(name || '').trim();
};

console.log('✅ [validators] Валідатори завантажено');