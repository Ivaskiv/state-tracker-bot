// src/webhooks/airtable.js
import { clearUserCache } from '../services/users.js';

export const handleAirtableWebhook = async (req, res) => {
  try {
    const { action, recordId, tableName, fields } = req.body;
    
    console.log('🔔 [Webhook] Airtable event:', { 
      action, 
      tableName, 
      recordId,
      timestamp: new Date().toISOString()
    });

    if (tableName === 'Users') {
      const tgId = fields?.['Telegram ID'];
      
      if (action === 'deleted' && tgId) {
        console.log('🗑️ [Webhook] User deleted, clearing cache:', { tgId });
        clearUserCache(tgId);
      }
      
      if (action === 'updated' && tgId) {
        console.log('🔄 [Webhook] User updated, clearing cache:', { tgId });
        clearUserCache(tgId);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};