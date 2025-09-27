/**
 * Перевірка чи є текст командою "пропустити"
 */
export const isSkip = (text) => {
  const normalized = String(text || '').trim().toLowerCase();
  return normalized === '⏭️ пропустити' || 
         normalized === 'пропустити' || 
         normalized === 'skip' || 
         normalized === '⏭️';
};

/**
 * Валідація email адреси
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = String(email || '').trim();
  return trimmed.length > 0 && trimmed.length <= 100 && emailRegex.test(trimmed);
};

/**
 * Валідація українського номера телефону
 */
export const isValidUaPhone = (phone) => {
  const phoneRegex = /^\+380\d{9}$/;
  const trimmed = String(phone || '').trim();
  return phoneRegex.test(trimmed);
};

/**
 * Валідація імені користувача
 */
export const isValidName = (name) => {
  const trimmed = String(name || '').trim();
  return trimmed.length >= 2 && trimmed.length <= 50 && trimmed !== '';
};

/**
 * Валідація плану підписки
 */
export const isValidPlan = (plan) => {
  const validPlans = ['trial', 'week', 'month', 'year', 'TRIAL', 'WEEK', 'MONTH', 'YEAR'];
  return validPlans.includes(String(plan || ''));
};

/**
 * Валідація формату часу HH:mm
 */
export const isHHmm = (time) => {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''));
};

/**
 * Обрізка тексту до 500 символів
 */
export const cut500 = (text) => {
  return String(text || '').trim().slice(0, 500);
};

/**
 * Очищення та форматування номера телефону
 */
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

/**
 * Очищення email
 */
export const formatEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

/**
 * Очищення імені
 */
export const formatName = (name) => {
  return String(name || '').trim();
};

console.log('✅ [validators] Валідатори ініціалізовано');