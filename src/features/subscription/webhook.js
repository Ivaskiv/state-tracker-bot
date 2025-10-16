// src/features/subscription/webhook.js — ВИПРАВЛЕНО ДЛЯ WAYFORPAY

import crypto from 'crypto';
import { tables, selectFromTable, updateRows } from '../../config/database.js';
import { SUBSCRIPTION_STATUS } from '../../config/index.js';
import users from '../../services/users.js';
import service from './service.js';

const secretKey = process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET';

/**
 * Перевірка підпису WayForPay webhook
 */
const verifySignature = (data, signature) => {
  try {
    // WayForPay использует этот порядок полей для подписи
    const signString = [
      data.merchantAccount || '',
      data.orderReference || '',
      data.amount || '',
      data.currency || '',
      data.authCode || '',
      data.cardPan || '',
      data.transactionStatus || '',
      data.reasonCode || ''
    ].join(';');

    const hash = crypto
      .createHmac('md5', secretKey)
      .update(signString)
      .digest('hex');

    console.log('[webhook] Перевірка підпису:');
    console.log('  Очікуємо:', signature);
    console.log('  Отримали:', hash);
    
    return hash === signature;
  } catch (error) {
    console.error('[webhook/verifySignature] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Обробка webhook від WayForPay
 */
const handleWayForPayWebhook = async (req, res) => {
  console.log('💳 [webhook] Отримано webhook від WayForPay');

  try {
    const data = req.body;

    console.log('[webhook] 📋 Дані:');
    console.log('  Order:', data.orderReference);
    console.log('  Status:', data.transactionStatus);
    console.log('  Amount:', data.amount);
    console.log('  Currency:', data.currency);

    // ✅ Перевірка підпису (якщо є)
    if (data.merchantSignature) {
      const isValid = verifySignature(data, data.merchantSignature);
      
      if (!isValid) {
        console.error('[webhook] ❌ Невалідний підпис');
        return res.status(400).json({ 
          error: 'Invalid signature',
          orderReference: data.orderReference,
          status: 'decline',
          time: Math.floor(Date.now() / 1000)
        });
      }
      
      console.log('[webhook] ✅ Підпис валідний');
    }

    // ✅ Парсимо orderReference: AIMENTOR_<PLAN>_<TGID>_<timestamp>
    const parts = String(data.orderReference || '').split('_');
    const planKey = parts?.[1] || '';
    const tgId = parts?.[2] || '';

    console.log('[webhook] 🔍 Розбір:');
    console.log('  Plan:', planKey);
    console.log('  TG ID:', tgId);

    if (!tgId || !planKey) {
      console.error('[webhook] ❌ Невалідний orderReference');
      return res.status(400).json({
        error: 'Invalid orderReference format',
        orderReference: data.orderReference,
        status: 'decline',
        time: Math.floor(Date.now() / 1000)
      });
    }

    // ✅ Обробка статусу
    let isApproved = false;

    switch (data.transactionStatus) {
      case 'Approved':
      case 'APPROVED':
        isApproved = true;
        console.log('[webhook] ✅ Статус: APPROVED');
        break;
      
      case 'Declined':
      case 'DECLINED':
        console.log('[webhook] ❌ Статус: DECLINED');
        isApproved = false;
        break;
      
      default:
        console.log('[webhook] ⏳ Статус: ', data.transactionStatus);
        isApproved = false;
    }

    // ✅ Якщо APPROVED — активуємо підписку
    if (isApproved) {
      try {
        const paymentData = {
          tgId,
          planKey,
          planName: `План ${planKey}`,
          amount: data.amount,
          duration: 7, // за замовчуванням
          orderReference: data.orderReference,
          userName: data.clientEmail?.split('@')[0] || 'Користувач'
        };

        const result = await service.activatePaidSubscription(paymentData);
        
        if (result.success) {
          console.log('[webhook] 💰 Підписка активована:', tgId);
        } else {
          console.error('[webhook] ❌ Помилка активації:', result.message);
        }
      } catch (e) {
        console.error('[webhook] ❌ Помилка обробки платежу:', e?.message || e);
      }
    }

    // ✅ Відповідь для WayForPay (підтвердження отримання)
    const response = {
      orderReference: data.orderReference,
      status: 'accept', // завжди повертаємо accept для WayForPay
      time: Math.floor(Date.now() / 1000)
    };

    console.log('[webhook] 📤 Відповідь:', response);
    res.status(200).json(response);

  } catch (error) {
    console.error('[webhook] ❌ Критична помилка:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      time: Math.floor(Date.now() / 1000)
    });
  }
};

export default handleWayForPayWebhook;

console.log('✅ [features/subscription/webhook] Webhook handler завантажено');