// src/features/subscription/service.js

import { SUBSCRIPTION_PLANS } from '../../config/constants.js';
import { tables, selectFromTable, createRows, updateRows } from '../../config/database.js';
import { addDays, toISODate } from '../../utils/helpers.js';
const USER_STATUS_FIELD = 'Subscription_Status';
const findActiveSubscription = async (tgId) => {
  try {
    const rows = await selectFromTable(tables.SUBSCRIPTIONS, {
      filterByFormula: `{TG_id}="${String(tgId)}"`,
      sort: [{ field: 'End_Date', direction: 'desc' }],
    }).firstPage();

    const now = new Date();
    return rows.find((r) => {
      const status = r.fields?.Status || 'Active';
      const end = r.fields?.End_Date ? new Date(r.fields.End_Date) : null;
      return status !== 'Inactive' && end && end > now;
    }) || null;
  } catch (e) {
    console.error('[subscription/service.findActiveSubscription] ❌', e?.message || e);
    return null;
  }
};

const findAllActive = async () => {
  try {
    return await selectFromTable(tables.SUBSCRIPTIONS, {
      filterByFormula: `NOT({Status} = 'Inactive')`,
      sort: [{ field: 'End_Date', direction: 'asc' }],
    }).all();
  } catch (e) {
    console.error('[subscription/service.findAllActive] ❌', e?.message || e);
    return [];
  }
};

export const createTrialSubscription = async (tgId, userName = 'Користувач') => {
  const plan = SUBSCRIPTION_PLANS.TRIAL;
  const start = new Date();
  const end = addDays(start, plan.duration);

  try {
    const rec = await createRows(tables.SUBSCRIPTIONS, [
      {
        fields: {
          TG_id: String(tgId),
          'User_Name': userName,
          Plan_Name: plan.name,
          Amount: 0,
          Start_Date: toISODate(start),
          End_Date: toISODate(end),
          Order_Reference: `TRIAL_${tgId}_${Date.now()}`,
          Payment_Status: 'Approved',
          Status: 'Active',
          Created_At: new Date().toISOString(),
        },
      },
    ]);

    await updateUserFields(tgId, {
      [USER_STATUS_FIELD]: 'Trial',
      'Active_Subscription_Plan': plan.name,
      Start_Date: toISODate(start),
      End_Date: toISODate(end),
    });

    console.log('[subscription/service] ✅ Trial створено:', rec?.[0]?.id || '(no id)');
    return rec?.[0] || null;
  } catch (e) {
    console.error('[subscription/service.createTrialSubscription] ❌', e?.message || e);
    throw e;
  }
};

export const checkSubscriptionStatus = async (tgId) => {
  try {
    const sub = await findActiveSubscription(tgId);
    if (!sub) return { active: false };

    const end = sub.fields?.End_Date ? new Date(sub.fields.End_Date) : null;
    const active = !!end && end > new Date();

    return {
      active,
      planName: sub.fields?.Plan_Name || '',
      startDate: sub.fields?.Start_Date || null,
      endDate: sub.fields?.End_Date || null,
      subscriptionId: sub.id,
    };
  } catch (e) {
    console.error('[subscription/service.checkSubscriptionStatus] ❌', e?.message || e);
    return { active: false };
  }
};

export const activatePaidSubscription = async (paymentData) => {
  const {
    tgId,
    planKey,
    planName,       
    amount,
    duration,
    orderReference,
    userName = 'Користувач',
  } = paymentData;

  const plan = SUBSCRIPTION_PLANS[(planKey || '').toUpperCase()] || {
    name: planName || 'План',
    duration: duration || 7,
  };

  const start = new Date();
  const end = addDays(start, plan.duration);

  try {
    const rec = await createRows(tables.SUBSCRIPTIONS, [
      {
        fields: {
          TG_id: String(tgId),
          'User_Name': userName,
          Plan_Name: plan.name,
          Amount: Number(amount) || 0,
          Start_Date: toISODate(start),
          End_Date: toISODate(end),
          Order_Reference: orderReference || `AIMENTOR_${planKey}_${tgId}_${Date.now()}`,
          Payment_Status: 'Approved',
          Status: 'Active',
          Created_At: new Date().toISOString(),
        },
      },
    ]);

    await updateUserFields(tgId, {
[USER_STATUS_FIELD]: 'Active',
      'Active_Subscription_Plan': plan.name,
      Start_Date: toISODate(start),
      End_Date: toISODate(end),
    });

    return {
      success: true,
      endDate: end.toISOString(),
      message: `✅ Підписка "${plan.name}" активована!\nДіє до: ${end.toLocaleDateString('uk-UA')}`,
      recordId: rec?.[0]?.id || null,
    };
  } catch (e) {
    console.error('[subscription/service.activatePaidSubscription] ❌', e?.message || e);
    return { success: false, message: '❌ Помилка активації підписки' };
  }
};

export const syncUserSubscription = async (tgId) => {
  try {
    const sub = await findActiveSubscription(tgId);

    if (!sub) {
      await updateUserFields(tgId, {
[USER_STATUS_FIELD]: 'Inactive',
        'Active_Subscription_Plan': '',
        Start_Date: null,
        End_Date: null,
      });

      return (
        '❌ Активних оплат не знайдено.\n\n' +
        '💡 Якщо ти щойно оплатила — зачекай хвилинку і натисни «🔄 Оновити».'
      );
    }

    const end = sub.fields?.End_Date ? new Date(sub.fields.End_Date) : null;
    const active = !!end && end > new Date();

    await updateUserFields(tgId, {
      [USER_STATUS_FIELD]: active ? 'Active' : 'Expired',
      'Active_Subscription_Plan': sub.fields?.Plan_Name || '',
      Start_Date: sub.fields?.Start_Date || null,
      End_Date: sub.fields?.End_Date || null,
    });

    return active
      ? `✅ Підписка активна: ${sub.fields?.Plan_Name}\nДіє до: ${end.toLocaleDateString('uk-UA')}`
      : `⚠️ Підписка закінчилась: ${sub.fields?.Plan_Name}\n` +
        `Закінчилась: ${end?.toLocaleDateString('uk-UA')}\n\n` +
        `💰 Продовжи підписку, щоб не втрачати доступ.`;
  } catch (e) {
    console.error('[subscription/service.syncUserSubscription] ❌', e?.message || e);
    return '❌ Помилка синхронізації. Спробуй пізніше або напиши в підтримку.';
  }
};

export const getUsersWithExpiringSubscriptions = async (daysAhead = 1) => {
  try {
    const all = await findAllActive();
    if (!all.length) return [];

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const max = addDays(now, daysAhead);

    const expiring = all.filter((r) => {
      const end = r.fields?.End_Date ? new Date(r.fields.End_Date) : null;
      if (!end) return false;
      end.setHours(0, 0, 0, 0);
      return end >= now && end <= max;
    });

    return expiring.map((sub) => ({
      TG_id: sub.fields.TG_id,
      'Active_Subscription_Plan': sub.fields.Plan_Name,
      End_Date: sub.fields.End_Date,
    }));
  } catch (e) {
    console.error('[subscription/service.getUsersWithExpiringSubscriptions] ❌', e?.message || e);
    return [];
  }
};

export const deactivateExpiredSubscriptions = async () => {
  try {
    const all = await findAllActive();
    if (!all.length) return 0;

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const toDeactivate = all
      .filter((r) => {
        const end = r.fields?.End_Date ? new Date(r.fields.End_Date) : null;
        if (!end) return false;
        end.setHours(0, 0, 0, 0);
        return end < today;
      })
      .map((r) => ({
        id: r.id,
        fields: { Status: 'Inactive', Updated_At: new Date().toISOString() },
      }));

    if (!toDeactivate.length) return 0;

    await updateRows(tables.SUBSCRIPTIONS, toDeactivate);
    return toDeactivate.length;
  } catch (e) {
    console.error('[subscription/service.deactivateExpiredSubscriptions] ❌', e?.message || e);
    return 0;
  }
  };
  export async function activateFreeTrial(tgId, days = 7, userName = 'Користувач') {
  // Використовуємо вже готову логіку створення записи в SUBSCRIPTIONS
  const plan = SUBSCRIPTION_PLANS.TRIAL;
  if (plan?.duration && plan.duration !== days) {
    // Якщо хочеш гнучко — створюй тимчасовий об’єкт plan із days
  }
  await createTrialSubscription(tgId, userName);
  return getUserByTgId(String(tgId));
}

export async function hasActiveAccess(userOrTgId) {
  // 1) швидка перевірка за записом SUBSCRIPTIONS
  const tgId = typeof userOrTgId === 'object' ? userOrTgId?.fields?.TG_id || userOrTgId?.id || userOrTgId?.tg_id : userOrTgId;
  const status = await checkSubscriptionStatus(String(tgId));
  if (status.active) return true;

  // 2) fallback: перевірка полів Users (на випадок розсинхрону)
  const user = typeof userOrTgId === 'object' && userOrTgId.fields ? userOrTgId : await getUserByTgId(String(tgId));
  if (!user?.fields) return false;
  const s = String(user.fields[USER_STATUS_FIELD] || '').toLowerCase();
  const endIso = user.fields.End_Date;
  const notExpired = endIso ? new Date(endIso).getTime() > Date.now() : false;
  return (['trial','active','month','year','mentorship'].includes(s)) && notExpired;
}


export default {
  createTrialSubscription,
  checkSubscriptionStatus,
  activatePaidSubscription,
  syncUserSubscription,
  getUsersWithExpiringSubscriptions,
  deactivateExpiredSubscriptions,

  activateFreeTrial,
  activateFreeTrial
};
