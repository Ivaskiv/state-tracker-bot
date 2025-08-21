// src/services/userService.js
import { getBase, tables } from "../config/database.js";
const base = getBase();

export const checkActiveSubscription = (userRecord) => {
  const activeStatus = userRecord.fields["Active_Subscription_Status"];
  return activeStatus && activeStatus.startsWith("✅");
};

export const moveActiveSubscriptionToUser = async (userRecord) => {
  const subs = await base(tables.SUBSCRIPTIONS)
    .select({
      filterByFormula: `{TG_id}='${userRecord.fields.TG_id}'`,
      sort: [{ field: "End_Date", direction: "desc" }],
      maxRecords: 1,
    })
    .firstPage();

  if (!subs.length) return false;

  const activeSub = subs.find((s) => s.fields.Is_Active === "✅ Активна");
  if (!activeSub) return false;

  await base(tables.USERS).update([
    {
      id: userRecord.id,
      fields: {
        "Subscription Status": "Active",
        "Active Subscription Plan": activeSub.fields.Plan_Name,
        Start_Date: activeSub.fields.Start_Date,
        End_Date: activeSub.fields.End_Date,
        Active_Subscription_Status:
          "✅ Активна до " +
          new Date(activeSub.fields.End_Date).toLocaleDateString("uk-UA"),
      },
    },
  ]);

  return true;
};

export const moveFutureSubscriptionToUser = async (userRecord) => {
  const subs = await base(tables.SUBSCRIPTIONS)
    .select({
      filterByFormula: `AND({TG_id}='${userRecord.fields.TG_id}', {Is_Future_Plan}="✅ Є наступний план")`,
      sort: [{ field: "Start_Date", direction: "asc" }],
      maxRecords: 1,
    })
    .firstPage();

  if (!subs.length) return false;

  const futureSub = subs[0];
  await base(tables.USERS).update([
    {
      id: userRecord.id,
      fields: {
        "Subscription Status": "Active",
        "Active Subscription Plan": futureSub.fields.Plan_Name,
        Start_Date: futureSub.fields.Start_Date,
        End_Date: futureSub.fields.End_Date,
        Active_Subscription_Status:
          "✅ Активна до " +
          new Date(futureSub.fields.End_Date).toLocaleDateString("uk-UA"),
      },
    },
  ]);

  return true;
};

export const handleStart = async ({ tgId, name }) => {
  let users = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}='${tgId}'`, maxRecords: 1 })
    .firstPage();

  let user;
  if (!users.length) {
    const newUser = await base(tables.USERS).create([
      {
        fields: {
          "User Name": name,
          TG_id: tgId.toString(),
          UserRegistered: true,
          DateUserRegistered: new Date().toISOString(),
          Status: "New User",
        },
      },
    ]);
    user = newUser[0];
  } else {
    user = users[0];
  }

  let subscriptionActive = checkActiveSubscription(user);
  if (!subscriptionActive) subscriptionActive = await moveActiveSubscriptionToUser(user);
  if (!subscriptionActive) subscriptionActive = await moveFutureSubscriptionToUser(user);

  const subscriptionLink = `https://wayforpay.com/pay?plan=${user.fields["Active Subscription Plan"] || "default"}`;
  const otherPlansLink = `https://wayforpay.com/plans`;
  user.fields.subscriptionLink = subscriptionLink;
  user.fields.otherPlansLink = otherPlansLink;

  return { user: user.fields, subscriptionActive };
};

export const getActiveUsers = async () => {
  try {
    const records = await base(tables.USERS)
      .select({ filterByFormula: `{Subscription Status}="Active"` })
      .all();

    return records.map(record => ({
      recordId: record.id,
      TG_id: record.fields.TG_id,
      "User Name": record.fields["User Name"]
    }));
  } catch (error) {
    console.error("Error getting active users:", error);
    return [];
  }
};

export default {
  handleStart,
  getActiveUsers,
  checkActiveSubscription,
  moveActiveSubscriptionToUser,
  moveFutureSubscriptionToUser
};
