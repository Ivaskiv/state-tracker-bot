// src/features/subscription/webhook.js
// Обробка webhook від WayForPay

import crypto from 'crypto';
import { tables, selectFromTable, updateRows } from '../../config/database.js';
import { SUBSCRIPTION_STATUS } from '../../config/index.js';

/**
 * Перевірка підпису WayForPay
 */
const verifySignature = (data, signature, merchantSecret) => {
  try {
    const signString = [
      data.merchantAccount,
      data.orderReference,
      data.amount,
      data.currency,
      data.authCode,
      data.cardPan,
      data.transactionStatus,
      data.reasonCode
    ].join(';');

    const hash = crypto
      .createHmac('md5', merchantSecret)
      .update(signString)
      .digest('hex');

    return hash === signature;
  } catch (error) {
    console.error('[webhook/verifySignature] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Оновити статус підписки після оплати
 */
const updateSubscriptionStatus = async (orderReference, status) => {
  try {
    console.log(`[webhook] Оновлення підписки ${orderReference} -> ${status}`);

    // Шукаємо підписку за Order_Reference
    const formula = `{Order_Reference} = "${orderReference}"`;
    const records = await selectFromTable(tables.SUBSCRIPTIONS, {
      filterByFormula: formula,
      maxRecords: 1
    }).firstPage();

    if (!records || records.length === 0) {
      console.error('[webhook] ❌ Підписка не знайдена:', orderReference);
      return false;
    }

    const subscription = records[0];

    // Оновлюємо статус
    await updateRows(tables.SUBSCRIPTIONS, [{
      id: subscription.id,
      fields: {
        Status: status,
        Payment_Date: new Date().toISOString(),
        Updated_At: new Date().toISOString()
      }
    }]);

    console.log(`[webhook] ✅ Підписка оновлена: ${orderReference}`);
    return true;
  } catch (error) {
    console.error('[webhook/updateSubscriptionStatus] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Головний handler для WayForPay webhook
 */
const handleWayForPayWebhook = async (req, res) => {
  console.log('💳 [webhook] Отримано webhook від WayForPay');

  try {
    const data = req.body;

    // Логування отриманих даних (без чутливої інформації)
    console.log('[webhook] Order:', data.orderReference);
    console.log('[webhook] Status:', data.transactionStatus);
    console.log('[webhook] Amount:', data.amount);

    // Перевірка підпису (якщо є merchant secret)
    const merchantSecret = process.env.WAYFORPAY_SECRET;
    if (merchantSecret && data.merchantSignature) {
      const isValid = verifySignature(data, data.merchantSignature, merchantSecret);
      
      if (!isValid) {
        console.error('[webhook] ❌ Невалідний підпис');
        return res.status(400).json({ 
          error: 'Invalid signature',
          orderReference: data.orderReference,
          time: new Date().toISOString()
        });
      }
      
      console.log('[webhook] ✅ Підпис валідний');
    }

    // Обробка статусу транзакції
    let subscriptionStatus;

    switch (data.transactionStatus) {
      case 'Approved':
        subscriptionStatus = SUBSCRIPTION_STATUS.APPROVED;
        break;
      case 'Pending':
        subscriptionStatus = SUBSCRIPTION_STATUS.PENDING;
        break;
      case 'Declined':
        subscriptionStatus = SUBSCRIPTION_STATUS.DECLINED;
        break;
      default:
        subscriptionStatus = data.transactionStatus;
    }

    // Оновлюємо підписку в базі
    const updated = await updateSubscriptionStatus(
      data.orderReference,
      subscriptionStatus
    );

    if (!updated) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        orderReference: data.orderReference,
        time: new Date().toISOString()
      });
    }

    // Відповідь для WayForPay (підтвердження отримання)
    res.status(200).json({
      orderReference: data.orderReference,
      status: 'accept',
      time: new Date().toISOString()
    });

    console.log('[webhook] ✅ Webhook оброблено успішно');

  } catch (error) {
    console.error('[webhook/handleWayForPayWebhook] ❌ Помилка:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      time: new Date().toISOString()
    });
  }
};

// ===== ЕКСПОРТ =====
export default handleWayForPayWebhook;

console.log('✅ [features/subscription/webhook] Webhook handler завантажено');