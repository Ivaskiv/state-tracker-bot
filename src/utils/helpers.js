//helpers.js
import { Markup } from 'telegraf';

export const createKeyboard = (buttons) => {
  if (!Array.isArray(buttons)) {
    console.error('Invalid buttons format:', buttons);
    return [];
  }
  return buttons.map(button => [Markup.button.callback(button.text, button.callback_data)]);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });
};

export const getWeekRange = (date = new Date()) => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

export const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return { start, end };
};

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const escapeMarkdown = (text) => {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const validateEmail = (email) => {
const re = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
return re.test(email);
};