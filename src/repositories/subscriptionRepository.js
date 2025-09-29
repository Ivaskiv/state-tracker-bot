// src/repositories/subscriptionRepository.js

import { createRecord, updateRecord } from '../config/database.js';

const TABLE = 'SUBSCRIPTIONS';

export const createSubscription = async (tgId, planData) => {
  const now = new Date().toISOString();
  
  const fields = {
    TG_id: String(tgId),
    'User Name': planData.userName || 'Користувач',
    'Order_Reference': planData.orderReference || `SUB_${tgId}_${Date.now()}`,
    'Payment_Status': planData.paymentStatus || 'Approved',
    Status: 'Active',
    'Plan_Name': planData.planName,
    Amount: planData.amount || 0,
    Currency: 'EUR',
    'Start_Date': planData.startDate || now,
    'End_Date': planData.endDate,
    'Is_Active': '✅ Активна',
    'Created_At': now
  };
  
  return await createRecord(TABLE, fields);
};

export default {
  createSubscription
};