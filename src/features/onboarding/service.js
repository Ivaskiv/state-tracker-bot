// ========================================
// src/features/onboarding/service.js
// ========================================
import { getBase, tables, updateRows } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

/**
 * Отримати дані для завершення реєстрації
 */
export const getRegistrationData = async (tgId) => {
  try {
    const user = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: ['User Name', 'Email', 'Phone', 'Time Zone', 'End_Date']
      })
      .firstPage();

    if (!user.length) return null;

    return user[0].fields;
  } catch (error) {
    logger.error('[onboarding/service] ❌ Помилка:', error);
    return null;
  }
};

/**
 * Відправити вітальне письмо (для майбутніх інтеграцій)
 */
export const sendWelcomeEmail = async (email, userName) => {
  logger.info(`[onboarding/service] 📧 Відправка вітального письма на ${email}`);
  // TODO: інтегрувати з email сервісом (SendGrid, Mailgun, etc)
};

console.log('✅ [onboarding/service] Завантажено');
