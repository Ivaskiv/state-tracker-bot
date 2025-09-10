// src/auth/services/subscriptionSync.js
import { getBase, tables } from '../../config/database.js';

const base = getBase();

/**
 * Синхронізує статус підписки користувача за останнім Approved-платежем.
 * Мінімальні зміни: не чіпаємо інші сервіси. Повертає короткий текст-результат.
 */
export async function syncUserSubscription(tgId) {
  if (!tgId) return '⚠️ Не вдалось визначити користувача.';

  // 1) Знайти останню активовану підписку
  const subs = await base(tables.SUBSCRIPTIONS)
    .select({
      filterByFormula: `AND({TG_id}='${tgId}', {Payment_Status}='Approved')`,
      sort: [{ field: 'End_Date', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();

  if (!subs.length) {
    // Скидаємо статус у Users, якщо активних оплат не знайдено
    const users = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id}='${tgId}'`, maxRecords: 1 })
      .firstPage();

    if (users.length) {
      await base(tables.USERS).update([
        {
          id: users[0].id,
          fields: {
            Active_Subscription_Status: '❌ Неактивна',
            'Active Subscription Plan': null,
            Start_Date: null,
            End_Date: null,
          },
        },
      ]);
    }
    return '❌ Активних оплат не знайдено. Якщо ти щойно оплатила — зачекай 1–2 хв або натисни ще раз «🔄 Оновити підписку».';
  }

  const s = subs[0].fields || {};
  const endDate = s.End_Date ? new Date(s.End_Date) : null;
  const endDateUA = endDate ? endDate.toLocaleDateString('uk-UA') : 'не відомо';
  const plan = s.Plan_Name || 'План';

  // 2) Оновити користувача (Users)
  const users = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}='${tgId}'`, maxRecords: 1 })
    .firstPage();

  if (users.length) {
    await base(tables.USERS).update([
      {
        id: users[0].id,
        fields: {
          Active_Subscription_Status: `✅ Активна до ${endDateUA}`,
          'Active Subscription Plan': plan,
          'Subscription Status': 'Active',
          Start_Date: s.Start_Date || users[0].fields.Start_Date || null,
          End_Date: s.End_Date || users[0].fields.End_Date || null,
        },
      },
    ]);
  }

  return `✅ Підписка синхронізована: ${plan}\nДіє до: ${endDateUA}`;
}

export default { syncUserSubscription };
