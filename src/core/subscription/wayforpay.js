// src/services/wayforpay.js

import crypto from 'crypto';
import { SUBSCRIPTION_PLANS, WAYFORPAY_LINKS } from '../config/constants.js';

/**
 * Базова конфігурація WayForPay із .env
 */
export const WAYFORPAY_CONFIG = {
  merchantAccount: process.env.WAYFORPAY_MERCHANT || 'test_merch_n1',
  merchantSecretKey: process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET',
  merchantDomainName: process.env.WAYFORPAY_DOMAIN || 'aimentor.com',
  serviceUrl:
    process.env.WAYFORPAY_SERVICE_URL ||
    `${process.env.WEBHOOK_URL || 'https://yourdomain.com'}/api/wayforpay/webhook`,
  returnUrl: process.env.WAYFORPAY_RETURN_URL || process.env.BOT_URL || 'https://t.me/your_bot_name',
};

/**
 * Підпис для checkout-запиту (офіційний порядок полів W4P)
 */
const generateCheckoutSignature = (data, secretKey) => {
  const signString = [
    data.merchantAccount,
    data.merchantDomainName,
    data.orderReference,
    data.orderDate,
    data.amount,
    data.currency,
    data.productName,
    data.productCount,
    data.productPrice,
  ].join(';');

  return crypto.createHmac('md5', secretKey).update(signString).digest('hex');
};

/**
 * Перевірка підпису webhook (WayForPay для callback використовує інший набір полів)
 */
export const verifyWebhookSignature = (data) => {
  try {
    const receivedSignature = data?.merchantSignature;
    if (!receivedSignature) return false;

    const signString = [data.merchantAccount, data.orderReference, data.amount, data.currency].join(';');

    const calculated = crypto
      .createHmac('md5', WAYFORPAY_CONFIG.merchantSecretKey)
      .update(signString)
      .digest('hex');

    return calculated === receivedSignature;
  } catch (e) {
    console.error('[wayforpay.verifyWebhookSignature] ❌', e?.message || e);
    return false;
  }
};

/**
 * Створення payload для прямого checkout (якщо колись підʼєднаєш API напряму)
 */
export const createPaymentRequest = (tgId, planKey, userEmail = null) => {
  const key = String(planKey || '').toUpperCase();
  const plan = SUBSCRIPTION_PLANS[key];
  if (!plan) throw new Error(`Невірний план: ${planKey}`);

  const orderReference = `AIMENTOR_${key}_${tgId}_${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const amount = plan.price;
  const currency = 'EUR';

  const signature = generateCheckoutSignature(
    {
      merchantAccount: WAYFORPAY_CONFIG.merchantAccount,
      merchantDomainName: WAYFORPAY_CONFIG.merchantDomainName,
      orderReference,
      orderDate,
      amount,
      currency,
      productName: plan.name,
      productCount: 1,
      productPrice: amount,
    },
    WAYFORPAY_CONFIG.merchantSecretKey,
  );

  return {
    merchantAccount: WAYFORPAY_CONFIG.merchantAccount,
    merchantDomainName: WAYFORPAY_CONFIG.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    orderTimeout: 3600,
    productName: [plan.name],
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
    clientAccountId: String(tgId),
    TG_id: String(tgId),
    planKey: key,
    planDuration: plan.duration,
  };
};

/**
 * Генерація URL для оплати через готові кнопки (Make.com / Hosted Button)
 * Використовує WAYFORPAY_LINKS з constants
 */
export const generatePaymentUrl = (tgId, planKey, userEmail = null) => {
  try {
    const key = String(planKey || '').toUpperCase();
    const baseUrl = WAYFORPAY_LINKS[key];
    const plan = SUBSCRIPTION_PLANS[key];

    if (!baseUrl || !plan) throw new Error(`Невідомий план: ${planKey}`);

    const orderReference = `AIMENTOR_${key}_${tgId}_${Date.now()}`;

    const params = new URLSearchParams({
      tg_id: String(tgId),
      orderReference,
      productName: encodeURIComponent(plan.name),
      clientEmail: userEmail || `user${tgId}@telegram.user`,
      amount: String(plan.price),
      currency: 'EUR',
    });

    return `${baseUrl}?${params.toString()}`;
  } catch (e) {
    console.error('[wayforpay.generatePaymentUrl] ❌', e?.message || e);
    return 'https://secure.wayforpay.com/payment/error';
  }
};

/**
 * Нормалізація webhook payload → уніфікований формат для subscription/service.activatePaidSubscription()
 */
export const processWebhookData = (webhookData) => {
  try {
    if (!verifyWebhookSignature(webhookData)) {
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
    } = webhookData;

    // очікуємо формат `AIMENTOR_<PLAN>_<TGID>_<timestamp>`
    const parts = String(orderReference || '').split('_');
    const planKey = parts?.[1] || '';
    const tgId = parts?.[2] || '';

    const plan = SUBSCRIPTION_PLANS[planKey] || null;
    const planName = plan ? plan.name : 'Невідомий план';
    const planDuration = plan ? plan.duration : 7;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + planDuration);

    return {
      // базове для нашого activatePaidSubscription():
      tgId: tgId,
      planKey,
      planName,
      amount: parseFloat(amount),
      duration: planDuration,
      orderReference,

      // інфо з webhook
      transactionStatus,
      currency,
      email: clientEmail,
      phone: clientPhone,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdDate: createdDate ? new Date(createdDate * 1000).toISOString() : startDate.toISOString(),
      processingDate: processingDate ? new Date(processingDate * 1000).toISOString() : null,
      isApproved: transactionStatus === 'Approved',
    };
  } catch (e) {
    console.error('[wayforpay.processWebhookData] ❌', e?.message || e);
    throw e;
  }
};

/**
 * Відповідь WayForPay після обробки webhook
 */
export const generateWebhookResponse = (orderReference, status = 'accept', time = null) => ({
  orderReference: orderReference || '',
  status,
  time: time || Math.floor(Date.now() / 1000),
});

/** Допоміжні */
export const isPlanValid = (planKey) => !!SUBSCRIPTION_PLANS[String(planKey || '').toUpperCase()];
export const getPlanInfo = (planKey) => SUBSCRIPTION_PLANS[String(planKey || '').toUpperCase()] || null;

/** Зручний default-експорт */
export default {
  WAYFORPAY_CONFIG,
  generatePaymentUrl,
  createPaymentRequest,
  processWebhookData,
  verifyWebhookSignature,
  generateWebhookResponse,
  isPlanValid,
  getPlanInfo,
};

console.log('[services/wayforpay] ✅ Ініціалізовано');
