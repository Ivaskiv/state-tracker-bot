import { Scenes } from 'telegraf';
import { getWayforpayLink } from '../utils/wayforpay.js';
import { updateUser } from '../utils/airtable.js';

export const paymentScene = new Scenes.BaseScene('payment');

paymentScene.enter(async (ctx) => {
  const plan = ctx.session.selectedPlan;
  const tgId = ctx.from.id;
  const orderReference = `ORD-${Date.now()}`;

  const productName = plan === 'weekly' ? 'Тиждень фокусу'
  : plan === 'monthly' ? 'Місяць дії'
  : 'Рік трансформації';

  const link = getWayforpayLink({ tgId, orderReference, productName, plan });

  await ctx.replyWithHTML(
    `${productName} — оплата через WayforPay:\n<a href="${link}">🔗 Оплатити</a>`
  );

  // зберігаємо orderReference у сесії, щоб після підтвердження знати що за платіж
  ctx.session.orderReference = orderReference;
});

// Тут можна додати хендлер Webhook від WayforPay або "manual check", який оновлює Paid
export async function handleWayforpayCallback({ tgId, orderReference }) {
  // оновлюємо користувача у Airtable
  await updateUser(tgId.toString(), { Paid: true });
}
