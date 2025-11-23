// src/tilda/config.js
import dotenv from 'dotenv';
dotenv.config();

export const TILDA_CONFIG = Object.freeze({
  // API Keys
  PUBLIC_KEY: process.env.TILDA_PUBLIC_KEY,
  SECRET_KEY: process.env.TILDA_SECRET_KEY,
  PROJECT_ID: process.env.TILDA_PROJECT_ID,
  
  // Pages
  MEMBER_AREA_PAGE_ID: process.env.TILDA_MEMBER_PAGE_ID,
  MEMBER_AREA_URL: process.env.TILDA_MEMBER_AREA_URL || 'https://star-way.pro/cabinet',
  
  // Webhooks
  WEBHOOK_URL: process.env.TILDA_WEBHOOK_URL,
  WEBHOOK_SECRET: process.env.TILDA_WEBHOOK_SECRET,
  
  // JWT
  JWT_EXPIRY_DAYS: 7,
  JWT_ALGORITHM: 'HS256',
  
  // Access levels
  ACCESS_LEVELS: {
    FREE: 'free',
    TRIAL: 'trial',
    PAID: 'paid',
    EXPIRED: 'expired'
  },
  
  // Settings
  ENABLE_LOGGING: process.env.TILDA_ENABLE_LOGGING === 'true',
  ENABLE_ANALYTICS: process.env.TILDA_ENABLE_ANALYTICS === 'true'
});

// Validation
const requiredEnvVars = [
  'TILDA_PUBLIC_KEY',
  'TILDA_SECRET_KEY',
  'TILDA_PROJECT_ID',
  'TILDA_MEMBER_PAGE_ID'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.warn(`⚠️ [Tilda Config] Missing env vars: ${missingVars.join(', ')}`); // ← ВИПРАВЛЕНО
}

console.log('✅ [Tilda Config] Завантажено');