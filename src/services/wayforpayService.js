// src/services/wayforpayService.js - ВИПРАВЛЕНО WAYFORPAY ІНТЕГРАЦІЮ ВІДПОВІДНО ДО ТЗ

import crypto from 'crypto';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

const WAYFORPAY_CONFIG = {
  merchantAccount: process.env.WAYFORPAY_MERCHANT || 'test_merch_n1',
  merchantSecretKey: process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET',
  merchantDomainName: process.env.WAYFORPAY_DOMAIN || 'aimentor.com',
  serviceUrl: process.env.WAYFORPAY_SERVICE_URL || `${process.env.WEBHOOK_URL || 'https://yourdomain.com'}/api/wayforpay/webhook`,
  returnUrl: process.env.WAYFORPAY_RETURN_URL || process.env.BOT_URL || 'https://t.me/your_bot_name'
};

// ✅ ГОТОВІ ПОСИЛАННЯ WAYFORPAY З MAKE.COM (З ДОКУМЕНТІВ)
const WAYFORPAY_BUTTON_LINKS = {
  WEEK: 'https://secure.wayforpay.com/button/b96923b913d29',
  MONTH: 'https://secure.wayforpay.com/button/b8df87678cd43', 
  YEAR: 'https://secure.wayforpay.com/button/bf28701123683'
};

// ✅ ПРАВИЛЬНА ГЕНЕРАЦІЯ ПІДПИСУ ДЛЯ WAYFORPAY
const generateSignature = (data, secretKey) => {
  // WayForPay потребує специфічного порядку полів для підпису
  const signString = [
    data.merchantAccount,
    data.merchantDomainName, 
    data.orderReference,
    data.orderDate,
    data.amount,
    data.currency,
    data.productName,
    data.productCount,
    data.productPrice
  ].join(';');
  
  return crypto.createHmac('md5', secretKey).update(signString).digest('hex');
};

// ✅ СТВОРЕННЯ ЗАПИТУ НА ОПЛАТУ
const createPaymentRequest = (tgId, planKey, userEmail = null) => {
  const planInfo = SUBSCRIPTION_PLANS[planKey];
  if (!planInfo) {
    throw new Error(`Невірний план: ${planKey}`);
  }

  const orderReference = `AIMENTOR_${planKey}_${tgId}_${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const amount = planInfo.price;
  const currency = 'EUR';
  
  const signatureData = {
    merchantAccount: WAYFORPAY_CONFIG.merchantAccount,
    merchantDomainName: WAYFORPAY_CONFIG.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName: planInfo.name,
    productCount: 1,
    productPrice: amount
  };

  const signature = generateSignature(signatureData, WAYFORPAY_CONFIG.merchantSecretKey);

  console.log(`[wayforpayService] ✅ Створено запит на оплату:`);
  console.log(`- План: ${planInfo.name}`);
  console.log(`- Сума: ${amount}€`);
  console.log(`- Order Reference: ${orderReference}`);
  console.log(`- Signature: ${signature}`);

  return {
    merchantAccount: WAYFORPAY_CONFIG.merchantAccount,
    merchantDomainName: WAYFORPAY_CONFIG.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    orderTimeout: 3600,
    productName: [planInfo.name],
    productPrice: [amount],
    productCount: [1],
    clientFirstName: 'aiMentor',
    clientLastName: 'User',
    clientEmail: userEmail || `user${tgId}@telegram.user`,
    clientPhone: '+380000000000',
    language: 'UA',
    serviceUrl: WAYFORPAY_CONFIG.serviceUrl,
    returnUrl: WAYFORPAY_CONFIG.returnUrl,
    merchantSignature: signature,
    // ДОДАНО: передаємо додаткову інформацію
    clientAccountId: tgId.toString(),
    TG_id: tgId,
    planKey: planKey,
    planDuration: planInfo.duration
  };
};

// ✅ ГЕНЕРАЦІЯ URL ДЛЯ ОПЛАТИ (ВИКОРИСТОВУЄМО ГОТОВІ ПОСИЛАННЯ)
const generatePaymentUrl = (tgId, planKey, userEmail = null) => {
  try {
    console.log(`[wayforpayService] 🔗 Генерація посилання для оплати:`);
    console.log(`- TG ID: ${tgId}`);
    console.log(`- План: ${planKey}`);
    console.log(`- Email: ${userEmail || 'не вказано'}`);

    // ✅ ВИКОРИСТОВУЄМО ГОТОВІ WAYFORPAY ПОСИЛАННЯ З MAKE.COM
    let baseUrl = '';
    switch(planKey.toUpperCase()) {
      case 'WEEK':
        baseUrl = WAYFORPAY_BUTTON_LINKS.WEEK;
        break;
      case 'MONTH':
        baseUrl = WAYFORPAY_BUTTON_LINKS.MONTH;
        break;
      case 'YEAR':
        baseUrl = WAYFORPAY_BUTTON_LINKS.YEAR;
        break;
      default:
        console.error(`[wayforpayService] ❌ Невідомий план: ${planKey}`);
        return `https://secure.wayforpay.com/payment/error`;
    }

    // ✅ ДОДАЄМО ПАРАМЕТРИ ДО ПОСИЛАННЯ
    const orderReference = `AIMENTOR_${planKey.toUpperCase()}_${tgId}_${Date.now()}`;
    const planInfo = SUBSCRIPTION_PLANS[planKey.toUpperCase()];
    
    const params = new URLSearchParams({
      tg_id: tgId.toString(),
      orderReference: orderReference,
      productName: encodeURIComponent(planInfo.name),
      clientEmail: userEmail || `user${tgId}@telegram.user`,
      amount: planInfo.price.toString(),
      currency: 'EUR'
    });

    const finalUrl = `${baseUrl}?${params.toString()}`;
    
    console.log(`[wayforpayService] ✅ Посилання створено: ${finalUrl}`);
    return finalUrl;

  } catch (error) {
    console.error('[wayforpayService] ❌ Помилка генерації URL:', error);
    return `https://secure.wayforpay.com/payment/error`;
  }
};

// ✅ ПЕРЕВІРКА ПІДПИСУ WEBHOOK
const verifyWebhookSignature = (data) => {
  try {
    const receivedSignature = data.merchantSignature;
    
    // Для webhook WayForPay використовує інший порядок полів
    const signString = [
      data.merchantAccount,
      data.orderReference, 
      data.amount,
      data.currency
    ].join(';');
    
    const calculatedSignature = crypto
      .createHmac('md5', WAYFORPAY_CONFIG.merchantSecretKey)
      .update(signString)
      .digest('hex');
    
    const isValid = receivedSignature === calculatedSignature;
    console.log(`[wayforpayService] 🔐 Перевірка підпису: ${isValid ? '✅ ВАЛІДНИЙ' : '❌ НЕВАЛІДНИЙ'}`);
    
    return isValid;
  } catch (error) {
    console.error('[wayforpayService] ❌ Помилка перевірки підпису:', error);
    return false;
  }
};

// ✅ ОБРОБКА WEBHOOK ДАНИХ
const processWebhookData = (webhookData) => {
  try {
    console.log('[wayforpayService] 🔔 Обробка webhook:', JSON.stringify(webhookData, null, 2));

    // ✅ Перевіряємо підпис
    if (!verifyWebhookSignature(webhookData)) {
      console.error('[wayforpayService] ❌ Невірний підпис webhook');
      throw new Error('Невірний підпис webhook');
    }

    const {
      orderReference,
      transactionStatus,
      amount,
      currency,
      clientEmail,
      clientPhone,
      createdDate,
      processingDate
    } = webhookData;

    // ✅ Витягуємо TG_id та planKey з orderReference
    const orderParts = orderReference.split('_');
    const planKey = orderParts[1];
    const tgId = orderParts[2];

    console.log(`[wayforpayService] 📋 Розпарсені дані:`);
    console.log(`- TG ID: ${tgId}`);
    console.log(`- План: ${planKey}`);
    console.log(`- Статус: ${transactionStatus}`);
    console.log(`- Сума: ${amount} ${currency}`);

    const planInfo = planKey ? SUBSCRIPTION_PLANS[planKey] : null;
    const planName = planInfo ? planInfo.name : 'Невідомий план';
    const planDuration = planInfo ? planInfo.duration : 7;

    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planDuration);

    const processedData = {
      tgId: tgId,
      orderReference,
      transactionStatus,
      amount: parseFloat(amount),
      currency,
      email: clientEmail,
      phone: clientPhone,
      planName,
      planKey,
      planDuration,
      startDate,
      endDate: endDate.toISOString(),
      createdDate: createdDate ? new Date(createdDate * 1000).toISOString() : startDate,
      processingDate: processingDate ? new Date(processingDate * 1000).toISOString() : null
    };

    console.log(`[wayforpayService] ✅ Оброблені дані:`, JSON.stringify(processedData, null, 2));
    return processedData;

  } catch (error) {
    console.error('[wayforpayService] ❌ Помилка обробки webhook:', error);
    throw error;
  }
};

// ✅ ГЕНЕРАЦІЯ ВІДПОВІДІ НА WEBHOOK
const generateWebhookResponse = (status = 'accept', time = null) => {
  const response = {
    orderReference: '',
    status,
    time: time || Math.floor(Date.now() / 1000)
  };
  
  console.log(`[wayforpayService] 📤 Відповідь на webhook: ${status}`);
  return response;
};

// ✅ ДОДАТКОВІ УТИЛІТАРНІ ФУНКЦІЇ
const isPlanValid = (planKey) => {
  return Object.keys(SUBSCRIPTION_PLANS).includes(planKey?.toUpperCase());
};

const getPlanInfo = (planKey) => {
  return SUBSCRIPTION_PLANS[planKey?.toUpperCase()] || null;
};

console.log('[wayforpayService] ✅ WayForPay сервіс ініціалізовано');
console.log(`- Merchant: ${WAYFORPAY_CONFIG.merchantAccount}`);
console.log(`- Domain: ${WAYFORPAY_CONFIG.merchantDomainName}`);
console.log(`- Service URL: ${WAYFORPAY_CONFIG.serviceUrl}`);
console.log(`- Return URL: ${WAYFORPAY_CONFIG.returnUrl}`);

export default {
  generatePaymentUrl,
  createPaymentRequest,
  processWebhookData,
  verifyWebhookSignature,
  generateWebhookResponse,
  isPlanValid,
  getPlanInfo,
  WAYFORPAY_CONFIG,
  WAYFORPAY_BUTTON_LINKS
};