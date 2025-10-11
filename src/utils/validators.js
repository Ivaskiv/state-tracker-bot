// src/utils/validators.js
// Загальні валідатори для всього проекту

import { CONFIG } from '../config/constants.js';

// ===== БАЗОВІ ПЕРЕВІРКИ (старі функції - залишаємо для сумісності) =====

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
  const cleaned = String(phone || '').replace(/[\s\-\(\)]/g, '');
  return CONFIG.PHONE_REGEX.test(cleaned);
};

// ===== ФОРМАТУВАННЯ =====

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

// ===== РОЗШИРЕНІ ВАЛІДАТОРИ З ДЕТАЛЯМИ =====

/**
 * Валідує ім'я з детальним повідомленням про помилку
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Ім\'я має бути текстом' };
  }
  
  const trimmed = formatName(name);
  
  if (trimmed.length < CONFIG.NAME_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Мінімум ${CONFIG.NAME_MIN_LENGTH} символи` 
    };
  }
  
  if (trimmed.length > CONFIG.NAME_MAX_LENGTH) {
    return { 
      valid: false, 
      error: `Максимум ${CONFIG.NAME_MAX_LENGTH} символів` 
    };
  }
  
  return { valid: true, value: trimmed };
};

/**
 * Валідує email з детальним повідомленням про помилку
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email має бути текстом' };
  }
  
  const trimmed = formatEmail(email);
  
  if (!trimmed) {
    return { valid: false, error: 'Email не може бути порожнім' };
  }
  
  if (trimmed.length > CONFIG.EMAIL_MAX_LENGTH) {
    return { valid: false, error: 'Email занадто довгий' };
  }
  
  if (!isValidEmail(trimmed)) {
    return { valid: false, error: 'Некоректний формат email' };
  }
  
  return { valid: true, value: trimmed };
};

/**
 * Валідує телефон з детальним повідомленням про помилку
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Телефон має бути текстом' };
  }
  
  const formatted = formatPhone(phone);
  
  if (!isValidPhone(formatted)) {
    return { 
      valid: false, 
      error: 'Формат: +380XXXXXXXXX (10 цифр після +380)' 
    };
  }
  
  return { valid: true, value: formatted };
};

/**
 * Валідує часовий пояс
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export const validateTimezone = (timezone) => {
  if (!timezone || typeof timezone !== 'string') {
    return { valid: false, error: 'Оберіть часовий пояс' };
  }
  
  const trimmed = timezone.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Часовий пояс не може бути порожнім' };
  }
  
  return { valid: true, value: trimmed };
};

// ===== ВАЛІДАЦІЯ ТЕКСТОВИХ ПОЛІВ =====

/**
 * Валідує текст мінімальної довжини
 */
export const validateMinLength = (text, minLength = 1) => {
  const trimmed = String(text || '').trim();
  return {
    valid: trimmed.length >= minLength,
    value: trimmed,
    error: trimmed.length < minLength 
      ? `Мінімум ${minLength} символів` 
      : null
  };
};

/**
 * Валідує текст максимальної довжини
 */
export const validateMaxLength = (text, maxLength = 1000) => {
  const trimmed = String(text || '').trim();
  return {
    valid: trimmed.length <= maxLength,
    value: trimmed,
    error: trimmed.length > maxLength 
      ? `Максимум ${maxLength} символів` 
      : null
  };
};

/**
 * Валідує текст в діапазоні довжини
 */
export const validateLength = (text, minLength = 1, maxLength = 1000) => {
  const trimmed = String(text || '').trim();
  
  if (trimmed.length < minLength) {
    return {
      valid: false,
      value: trimmed,
      error: `Мінімум ${minLength} символів`
    };
  }
  
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      value: trimmed,
      error: `Максимум ${maxLength} символів`
    };
  }
  
  return { valid: true, value: trimmed };
};

// ===== ВАЛІДАЦІЯ ЧИСЛОВИХ ЗНАЧЕНЬ =====

/**
 * Валідує число в діапазоні
 */
export const validateNumber = (value, min = 0, max = 10) => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Має бути числом' };
  }
  
  if (num < min) {
    return { valid: false, error: `Мінімум ${min}` };
  }
  
  if (num > max) {
    return { valid: false, error: `Максимум ${max}` };
  }
  
  return { valid: true, value: num };
};

/**
 * Валідує оцінку для колеса балансу (0-10)
 */
export const validateWheelRating = (rating) => {
  return validateNumber(rating, 0, 10);
};

console.log('✅ [validators] Валідатори завантажено');