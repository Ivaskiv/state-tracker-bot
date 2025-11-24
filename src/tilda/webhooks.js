// src/tilda/webhooks.js

import { getBase, tables } from '../config/database.js';
import { activateTrial } from '../services/users.js';
import { Telegraf } from 'telegraf';
import logger from '../utils/logger.js';

const base = getBase();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const WEBAPP_URL = process.env.NGROK_URL || process.env.WEBAPP_URL || 'https://star-way.pro';

export const handleTildaFormWebhook = async (req, res) => {
  try {
    console.log('📨 [Tilda Webhook] Отримано:', JSON.stringify(req.body, null, 2));
    
    const data = req.body;
    
    const tgId = data.tg_id || data['tg_id'] || data.TG_id || data['Hidden Field'];
    const name = data.name || data.Name;
    const email = data.email || data.Email;
    const phone = data.phone || data.Phone;
    
    console.log('📊 [Tilda Webhook] Parsed:', { tgId, name, email, phone });
    
    if (!tgId) {
      console.error('❌ [Tilda Webhook] TG_id відсутній!');
      console.log('❌ Доступні поля:', Object.keys(data));
      return res.status(400).json({ 
        error: 'TG_id обов\'язковий', 
        availableFields: Object.keys(data) 
      });
    }
    
    if (!email) {
      console.error('❌ [Tilda Webhook] Email відсутній!');
      return res.status(400).json({ error: 'Email обов\'язковий' });
    }
    
    // Перевіряємо чи користувач існує
    const existingUsers = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1
      })
      .firstPage();
    
    if (existingUsers.length > 0) {
      console.log('🔄 [Tilda Webhook] Оновлюємо користувача:', tgId);
      
      await base(tables.USERS).update([{
        id: existingUsers[0].id,
        fields: {
          'User_Name': name,
          'Email': email,
          'Phone': phone || null,
          'UserRegistered': true,
          'Answer_Step': 'IDLE',
          'Status': 'Active',
          'Last Modified': new Date().toISOString(),
        }
      }]);
      
      console.log('✅ [Tilda Webhook] Оновлено');
    } else {
      console.log('🆕 [Tilda Webhook] Створюємо користувача:', tgId);
      
      await base(tables.USERS).create([{
        fields: {
          'TG_id': String(tgId),
          'User_Name': name,
          'Email': email,
          'Phone': phone || null,
          'Time_Zone': 'Europe/Kiev',
          'UserRegistered': true,
          'Answer_Step': 'IDLE',
          'Status': 'Active',
          'Created At': new Date().toISOString(),
          'Source': 'webapp_registration'
        }
      }]);
      
      console.log('✅ [Tilda Webhook] Створено');
    }
    
    // Активуємо trial
    await activateTrial(tgId, 7);
    console.log('✅ [Tilda Webhook] Trial активовано');
    
    // ✅ Використовуємо WEBAPP_URL для кнопок
    const cabinetUrl = `${WEBAPP_URL}/webapp/cabinet.html?tg_id=${tgId}`;
    
    // Welcome повідомлення
    try {
      await bot.telegram.sendMessage(
        tgId,
        '🎉 **Реєстрацію завершено!**\n\n' +
        '✅ Активовано 7 днів доступу!\n\n' +
        '**Тобі доступні:**\n' +
        '• 🎯 Колесо балансу\n' +
        '• 🌞🌙 Щоденні рефлексії\n' +
        '• 🤖 AI-наставник 24/7\n' +
        '• 📂 Особистий кабінет\n\n' +
        'Почнемо? 👇',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Почати Колесо балансу', callback_data: 'wheel_start' }],
              [{ text: '🔗 Відкрити кабінет', web_app: { url: cabinetUrl } }],  // ✅ Використовуємо WEBAPP_URL
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      console.log('✅ [Tilda Webhook] Welcome відправлено');
      console.log('🔗 [Tilda Webhook] Cabinet URL:', cabinetUrl);
    } catch (telegramErr) {
      console.error('❌ [Tilda Webhook] Telegram помилка:', telegramErr);
    }
    
    res.json({ success: true, tgId });
    
  } catch (err) {
    console.error('❌ [Tilda Webhook] Error:', err);
    logger.error('[Tilda Webhook]', err);
    res.status(500).json({ error: err.message });
  }
};

console.log('✅ [Tilda Webhooks] Завантажено');
console.log('🌐 [Tilda Webhooks] WEBAPP_URL:', WEBAPP_URL);