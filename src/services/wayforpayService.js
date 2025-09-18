// src/services/wayforpayService.js - ДОДАНО РЕАЛЬНА ІНТЕГРАЦІЯ
import crypto from 'crypto';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

const WAYFORPAY_CONFIG = {
  merchantAccount: process.env.WAYFORPAY_MERCHANT || 'test_merch_n1',
  merchantSecretKey: process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET',
  merchantDomainName: process.env.WAYFORPAY_DOMAIN || 'aimentor.com',
  serviceUrl: process.env.WAYFORPAY_SERVICE_URL || 'https://your-domain.com/api/wayforpay/webhook',
  returnUrl: process.env.WAYFORPAY_RETURN_URL || 'https://t.me/your_bot_name'
};

// ВИПРАВЛЕНО: правильна генерація підпису для WayForPay
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

// ВИПРАВЛЕНО: правильна генерація URL для WayForPay
const generatePaymentUrl = (tgId, planKey, userEmail = null) => {
  try {
    const paymentRequest = createPaymentRequest(tgId, planKey, userEmail);
    
    const baseUrl = 'https://secure.wayforpay.com/pay';
    const params = new URLSearchParams();
    
    // Додаємо всі параметри
    Object.entries(paymentRequest).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v, index) => params.append(`${key}[${index}]`, v));
      } else {
        params.append(key, value);
      }
    });

    return `${baseUrl}?${params.toString()}`;
  } catch (error) {
    console.error('[wayforpayService.generatePaymentUrl] Помилка:', error);
    return `https://secure.wayforpay.com/payment/fallback`;
  }
};

// ДОДАНО: перевірка підпису webhook
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
    
    return receivedSignature === calculatedSignature;
  } catch (error) {
    console.error('[wayforpayService.verifyWebhookSignature] Помилка:', error);
    return false;
  }
};

// ВИПРАВЛЕНО: правильна обробка webhook даних
const processWebhookData = (webhookData) => {
  try {
    console.log('[wayforpayService] Обробка webhook:', JSON.stringify(webhookData, null, 2));

    // Перевіряємо підпис
    if (!verifyWebhookSignature(webhookData)) {
      console.error('[wayforpayService] Невірний підпис webhook');
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

    // Витягуємо TG_id та planKey з orderReference
    const orderParts = orderReference.split('_');
    const planKey = orderParts[1];
    const TG_id = orderParts[2];

    const planInfo = planKey ? SUBSCRIPTION_PLANS[planKey] : null;
    const planName = planInfo ? planInfo.name : 'Невідомий план';
    const planDuration = planInfo ? planInfo.duration : 7;

    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planDuration);

    return {
      tgId: TG_id,
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
  } catch (error) {
    console.error('[wayforpayService.processWebhookData] Помилка:', error);
    throw error;
  }
};

const generateWebhookResponse = (status = 'accept', time = null) => {
  return {
    orderReference: '',
    status,
    time: time || Math.floor(Date.now() / 1000)
  };
};

export default {
  generatePaymentUrl,
  createPaymentRequest,
  processWebhookData,
  verifyWebhookSignature,
  generateWebhookResponse,
  WAYFORPAY_CONFIG
};