// src/utils/formatters.js

// ===============================================================
// 🎡 WHEEL BALANCE ФОРМАТЕРИ
// ===============================================================

/**
 * Маппінг сфер на поля нотаток в Airtable
 */
export const getNoteField = (sphereKey) => ({
  Health: 'Health_Notes',
  Self_Growth: 'Self_Growth_Notes',
  Relationships: 'Relationships_Notes',
  Career_Business: 'Career_Notes',
  Finance: 'Finance_Notes',
  Rest_Leisure: 'Leisure_Notes',
  Spirituality: 'Spirituality_Notes',
  Housing: 'Housing_Notes'
}[sphereKey]);

/**
 * Маппінг сфер на emoji
 */
export const getSphereEmoji = (sphereKey) => ({
  Health: '❤️',
  Self_Growth: '📚',
  Relationships: '👥',
  Career_Business: '💼',
  Finance: '💰',
  Rest_Leisure: '🎨',
  Spirituality: '🧘',
  Housing: '🏠'
}[sphereKey]);

// ===============================================================
// 💰 GENERAL ФОРМАТЕРИ
// ===============================================================

export const formatPhoneDisplay = (phone) => {
  if (!phone) return 'не вказано';
  const cleaned = String(phone).replace(/\D/g, '');
  return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
};

export const formatTimeDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}г ${minutes % 60}м`;
  if (minutes > 0) return `${minutes}м ${seconds % 60}с`;
  return `${seconds}с`;
};

export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const formatCurrency = (amount, currency = '€') => {
  return `${amount.toFixed(2)}${currency}`;
};

export const highlightText = (text, highlight) => {
  if (!highlight) return text;
  const regex = new RegExp(`(${highlight})`, 'gi');
  return text.replace(regex, '**$1**');
};

/**
 * Форматувати число як відсоток
 */
export const formatPercent = (value, total) => {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

/**
 * Форматувати число з розділювачем тисяч
 */
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Форматувати очку за 0-10 шкалою
 */
export const formatScore = (score, maxScore = 10) => {
  if (score === null || score === undefined) return '?';
  return `${score}/${maxScore}`;
};

/**
 * Отримати відповідь за оцінкою
 */
export const getScoreFeedback = (score) => {
  if (score >= 9) return '🌟 Відмінно!';
  if (score >= 7) return '✅ Добре!';
  if (score >= 5) return '⚠️ Нормально';
  if (score >= 3) return '❌ Потрібна робота';
  return '🚨 Критично';
};

console.log('✅ [utils/formatters] Завантажено');