// src/api/webhookController.js - WEBHOOK ENDPOINT ДЛЯ WAYFORPAY

import wayforpayService from '../services/wayforpayService.js';
import subscriptionService from '../services/subscriptionService.js';

// ===== ОБРОБКА WAYFORPAY WEBHOOK =====
export const handleWayForPayWebhook = async (req, res) => {
  try {
    console.log('[webhook] 🔔 Отримано webhook від WayForPay');
    console.log('[webhook] Body:', JSON.stringify(req.body, null, 2));
    
    // Обробляємо дані
    const paymentData = wayforpayService.processWebhookData(req.body);
    
    if (!paymentData.isApproved) {
      console.log(`[webhook] ⚠️ Оплата не схвалена: ${paymentData.transactionStatus}`);
      return res.json({ orderReference: paymentData.orderReference, status: 'decline', time: Math.floor(Date.now() / 1000) });
    }
    
    // Активуємо підписку
    const result = await subscriptionService.activatePaidSubscription({
      tgId: paymentData.tgId,
      planKey: paymentData.planKey,
      planName: paymentData.planName,
      amount: paymentData.amount,
      duration: paymentData.planDuration,
      orderReference: paymentData.orderReference,
      userName: 'Користувач'
    });
    
    if (result.success) {
      console.log(`[webhook] ✅ Підписку активовано для ${paymentData.tgId}`);
      
      // Відправляємо позитивну відповідь WayForPay
      return res.json({
        orderReference: paymentData.orderReference,
        status: 'accept',
        time: Math.floor(Date.now() / 1000)
      });
    } else {
      console.error('[webhook] ❌ Помилка активації підписки');
      return res.json({
        orderReference: paymentData.orderReference,
        status: 'decline',
        time: Math.floor(Date.now() / 1000)
      });
    }
    
  } catch (error) {
    console.error('[webhook] ❌ Помилка обробки webhook:', error);
    
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

export default {
  handleWayForPayWebhook
};