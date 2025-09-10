// src/services/wayforpayService.js
import crypto from 'crypto';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

// Налаштування WayForPay (додати у .env)
const WAYFORPAY_CONFIG = {
  merchantAccount: process.env.WAYFORPAY_MERCHANT, // з особистого кабінету WayForPay
  merchantSecretKey: process.env.WAYFORPAY_SECRET, // секретний ключ
  merchantDomainName: process.env.WAYFORPAY_DOMAIN || 'aimentor.com',
  serviceUrl: process.env.WAYFORPAY_SERVICE_URL || 'https://yourdomain.com/api/wayforpay/webhook',
  returnUrl: process.env.WAYFORPAY_RETURN_URL || 'https://t.me/your_bot_name'
};

// Генерація підпису для WayForPay
const generateSignature = (data, secretKey) => {
  const signString = Object.values(data).join(';');
  return crypto.createHmac('md5', secretKey).update(signString).digest('hex');
};

// Створення замовлення для WayForPay
const createPaymentRequest = (tgId, planKey, userEmail = null) => {
  const planInfo = SUBSCRIPTION_PLANS[planKey];
  if (!planInfo) {
    throw new Error(`Невірний план: ${planKey}`);
  }

  const orderReference = `ORDER_${planKey}_${tgId}_${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000); // Unix timestamp
  const amount = planInfo.price;
  const currency = 'EUR';
  
  // Базові дані для підпису
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

  // Генеруємо підпис
  const signature = generateSignature(signatureData, WAYFORPAY_CONFIG.merchantSecretKey);

  // Повний запит до WayForPay
  const paymentRequest = {
    merchantAccount: WAYFORPAY_CONFIG.merchantAccount,
    merchantDomainName: WAYFORPAY_CONFIG.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    orderTimeout: 3600, // 1 година
    productName: [planInfo.name],
    productPrice: [amount],
    productCount: [1],
    clientFirstName: 'aiMentor',
    clientLastName: 'User',
    clientEmail: userEmail || `user${tgId}@telegram.user`,
    clientPhone: '+380000000000', // заглушка
    language: 'UA',
    serviceUrl: WAYFORPAY_CONFIG.serviceUrl,
    returnUrl: WAYFORPAY_CONFIG.returnUrl,
    merchantSignature: signature,
    // Додаткові дані для ідентифікації
    clientAccountId: tgId.toString(),
    socialUri: `tg://user?id=${tgId}`,
    // Персоналізовані дані
    TG_id: tgId,
    planKey: planKey,
    planDuration: planInfo.duration
  };

  return paymentRequest;
};

// Генерація URL для оплати
const generatePaymentUrl = (tgId, planKey, userEmail = null) => {
  try {
    const paymentRequest = createPaymentRequest(tgId, planKey, userEmail);
    
    // Формуємо URL з параметрами для redirect до WayForPay
    const baseUrl = 'https://secure.wayforpay.com/pay';
    const params = new URLSearchParams();
    
    Object.entries(paymentRequest).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(`${key}[]`, v));
      } else {
        params.append(key, value);
      }
    });

    return `${baseUrl}?${params.toString()}`;
  } catch (error) {
    console.error('[wayforpayService.generatePaymentUrl] Помилка:', error);
    // Fallback URL
    return `https://secure.wayforpay.com/payment/fallback_${planKey}_${tgId}`;
  }
};

// Перевірка підпису від WayForPay webhook
const verifyWebhookSignature = (data) => {
  try {
    const receivedSignature = data.merchantSignature;
    delete data.merchantSignature; // видаляємо підпис для перевірки
    
    const calculatedSignature = generateSignature(data, WAYFORPAY_CONFIG.merchantSecretKey);
    
    return receivedSignature === calculatedSignature;
  } catch (error) {
    console.error('[wayforpayService.verifyWebhookSignature] Помилка:', error);
    return false;
  }
};

// Обробка даних від WayForPay webhook
const processWebhookData = (webhookData) => {
  try {
    // Перевіряємо підпис
    if (!verifyWebhookSignature({...webhookData})) {
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
      processingDate,
      TG_id,
      planKey,
      planDuration
    } = webhookData;

    // Визначаємо план
    const planInfo = planKey ? SUBSCRIPTION_PLANS[planKey] : null;
    const planName = planInfo ? planInfo.name : 'Невідомий план';

    // Розраховуємо дати
    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (planDuration || 7));

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

// Відповідь для WayForPay webhook
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