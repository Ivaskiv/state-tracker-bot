// Нагадування
// src/services/wheelBalance/reminders.js
import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';

const base = getBase();

export const shouldShowWheelReminder = async (tgId, regDate) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", OR({Status}="Completed", {Status}="In Progress"))`,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .all();
    
    const now = new Date();
    
    // 1. ПЕРШЕ КОЛЕСО
    if (records.length === 0) {
      return { 
        needed: true, 
        type: 'first', 
        message: 'Час заповнити перше колесо балансу!' 
      };
    }
    
    // 2. НЕЗАВЕРШЕНЕ КОЛЕСО
    const active = records.find(r => r.fields.Status === 'In Progress');
    if (active) {
      const hoursSinceStart = (now - new Date(active.fields.Created_Date)) / 3600000;
      return { 
        needed: true, 
        type: 'continue', 
        recordId: active.id, 
        message: hoursSinceStart > 24 
          ? 'У тебе є незавершене колесо з минулого дня. Продовжимо?'
          : 'У тебе є незавершене колесо. Продовжимо?'
      };
    }
    
    // 3. ПЕРЕВІРКА ОСТАННЬОГО ЗАВЕРШЕНОГО
    const lastCompleted = records.find(r => r.fields.Status === 'Completed');
    if (lastCompleted) {
      const daysSince = Math.floor((now - new Date(lastCompleted.fields.Completed_Date)) / 86400000);
      
      if (daysSince < 30) {
        return { 
          needed: false, 
          type: 'recent', 
          daysSince, 
          message: `Останнє колесо було ${daysSince} днів тому.`
        };
      }
      
      return { 
        needed: true, 
        type: 'monthly', 
        message: `Минуло ${daysSince} днів з останнього колеса. Час для нового!` 
      };
    }
    
    // 4. FALLBACK
    return { 
      needed: true, 
      type: 'first', 
      message: 'Час заповнити перше колесо!' 
    };
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка shouldShowWheelReminder:', error);
    return { 
      needed: true, 
      type: 'error', 
      message: 'Заповни колесо балансу.' 
    };
  }
};

export const sendMonthlyWheelReminders = async (bot) => {
  try {
    logger.info('🎯 [wheelBalance] Щомісячна перевірка');
    
    const activeUsers = await base(tables.USERS)
      .select({
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`,
        fields: ['TG_id', 'User Name', 'Registration Date']
      })
      .all();

    let sent = 0;
    
    for (const user of activeUsers) {
      const tgId = user.fields.TG_id;
      const check = await shouldShowWheelReminder(tgId, user.fields['Registration Date']);
      
      if (check.needed && (check.type === 'monthly' || check.type === 'first')) {
        const message = check.type === 'first'
          ? `🎯 Привіт! ${check.message}\n\n⏱ 5-10 хвилин`
          : `📅 ${check.message}\n\n⏱ Оновимо профіль?`;
        
        await bot.telegram.sendMessage(tgId, message, {
          reply_markup: {
            inline_keyboard: [[{ text: '🎯 Заповнити', callback_data: 'wheel_start' }]]
          }
        });
        
        sent++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    logger.info(`🎯 [wheelBalance] Надіслано ${sent} нагадувань`);
    return sent;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка нагадувань:', error);
    return 0;
  }
};