// src/tilda/webhooks.js

import { handleTildaFormSubmit } from './service.js';
import { TILDA_CONFIG } from './config.js';
import logger from '../utils/logger.js';

export const handleTildaFormWebhook = async (req, res) => {
  try {
    const formData = req.body;
    
    logger.info('[Tilda Webhook] 📩 Form data received:', {
      formid: formData.formid,
      Email: formData.Email,
      TG_ID: formData.TG_ID
    });
    
    if (TILDA_CONFIG.WEBHOOK_SECRET) {
      const providedSecret = req.headers['x-tilda-secret'];
      if (providedSecret !== TILDA_CONFIG.WEBHOOK_SECRET) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    }
    
    const result = await handleTildaFormSubmit(formData);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('[Tilda Webhook] ❌', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

console.log('✅ [Tilda Webhooks] Завантажено');
