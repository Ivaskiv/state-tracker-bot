import { Scenes, Markup } from 'telegraf';
import { config } from '../config/config.js';
import { updateUser, createSubscription, formatDate, formatDateTime } from '../utils/airtable.js';

export const paymentScene = new Scenes.BaseScene('payment');

// Entry point for the payment scene
paymentScene.enter(async (ctx) => {
  try {
    const { selectedPlan } = ctx.session;
    const tgId = ctx.from.id.toString();
    const userName = ctx.from.first_name || 'Unknown';
    const userEmail = ctx.from.username ? `${ctx.from.username}@telegram.user` : '';

    // Validate selected plan
    if (!selectedPlan || !config.pricing[selectedPlan]) {
      await ctx.reply('❌ Неправильний план підписки. Спробуйте ще раз.');
      return ctx.scene.leave();
    }

    const planInfo = config.pricing[selectedPlan];
    const orderReference = `ORD-${Date.now()}-${tgId}`;

    // Create subscription record
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + planInfo.duration);

    await createSubscription({
      Subscription_ID: orderReference,
      User_ID: tgId,
      UserName: userName,
      User_Email: userEmail,
      TG_id: tgId,
      'Last Modified': formatDateTime(),
      Plan_Name: planInfo.text,
      Order_Reference: orderReference,
      Is_Extension: false,
      Payment_Status: 'Pending',
      Status: 'Pending',
      Plan_Type: selectedPlan,
      Created_Date: formatDate(),
      Start_Date: formatDate(),
      End_Date: formatDate(endDate),
      Amount: planInfo.price,
      Payment_Method: 'WayforPay',
    });

    // Store session data
    ctx.session.orderReference = orderReference;
    ctx.session.planInfo = planInfo;

    // Generate payment link (placeholder for WayforPay)
    const paymentLink = generatePaymentLink({
      tgId,
      orderReference,
      productName: planInfo.text.replace('🔹 ', ''),
      amount: planInfo.price,
      plan: selectedPlan,
    });

    // Create payment keyboard
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('💳 Оплатити', paymentLink)],
      [Markup.button.callback('✅ Я оплатив(ла)', 'payment_completed')],
      [Markup.button.callback('❌ Скасувати', 'payment_cancel')],
    ]);

    await ctx.reply(
      `💰 Ви обрали: ${planInfo.text}\n💵 Сума: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів\n\n🔗 Натисніть кнопку нижче для оплати:`,
      keyboard
    );

    // Update user with order reference
    await updateUser(tgId, {
      lastOrderReference: orderReference
    });
  } catch (error) {
    console.error('Error in payment scene enter:', error.message);
    await ctx.reply('❌ Помилка при обробці оплати. Спробуйте ще раз.');
    ctx.scene.leave();
  }
});

// Handle "payment completed" action
paymentScene.action('payment_completed', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Так, оплатив(ла)', 'confirm_payment')],
      [Markup.button.callback('❌ Ні, ще не оплатив(ла)', 'cancel_payment')],
    ]);

    await ctx.reply('Ви впевнені, що оплата пройшла успішно?', keyboard);
  } catch (error) {
    console.error('Error in payment completed action:', error.message);
    await ctx.answerCbQuery('❌ Помилка при підтвердженні оплати');
    ctx.scene.leave();
  }
});

// Handle payment confirmation
paymentScene.action('confirm_payment', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id.toString();
    const { orderReference, planInfo } = ctx.session;

    // Validate session data
    if (!orderReference || !planInfo) {
      await ctx.reply('❌ Помилка: дані сесії втрачено. Спробуйте ще раз.');
      return ctx.scene.leave();
    }

    // Confirm payment (simulated, replace with webhook in production)
    await handlePaymentConfirmation(tgId, orderReference, planInfo);

    await ctx.reply(
      `${config.messages.paymentSuccess}\n\n🎯 Тепер ти можеш використовувати:\n• /morning — для ранкових сесій\n• /evening — для вечірніх рефлексій\n\n💫 Вітаємо у спільноті трансформації!`
    );

    // Clear session
    delete ctx.session.selectedPlan;
    delete ctx.session.orderReference;
    delete ctx.session.planInfo;

    ctx.scene.leave();
  } catch (error) {
    console.error('Error confirming payment:', error.message);
    await ctx.answerCbQuery('❌ Помилка при підтвердженні оплати');
    ctx.scene.leave();
  }
});

// Handle payment cancellation (from confirmation prompt)
paymentScene.action('cancel_payment', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('❌ Оплата не підтверджена. Поверніться, коли будете готові.');
    ctx.scene.leave();
  } catch (error) {
    console.error('Error in cancel payment action:', error.message);
    await ctx.answerCbQuery('❌ Помилка при скасуванні');
    ctx.scene.leave();
  }
});

// Handle payment cancellation (from initial payment screen)
paymentScene.action('payment_cancel', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('❌ Оплату скасовано. Ви можете повернутися до неї пізніше командою /start.');
    // Clear session
    delete ctx.session.selectedPlan;
    delete ctx.session.orderReference;
    delete ctx.session.planInfo;
    ctx.scene.leave();
  } catch (error) {
    console.error('Error in payment cancel action:', error.message);
    await ctx.answerCbQuery('❌ Помилка при скасуванні');
    ctx.scene.leave();
  }
});

// Helper function to generate payment link
function generatePaymentLink({ tgId, orderReference, productName, amount, plan }) {
  // Placeholder for WayforPay integration
  const baseUrl = process.env.PAYMENT_WEBHOOK_URL;
  return `${baseUrl}/payment?order=${orderReference}&amount=${amount}&user=${tgId}&plan=${plan}`;
}

// Helper function to handle payment confirmation
async function handlePaymentConfirmation(tgId, orderReference, planInfo) {
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + planInfo.duration);

    // Update user with subscription details
    await updateUser(tgId, {
      Status: 'Active User',
      'Active_Subscription_Status': `✅ Активна до ${endDate.toLocaleDateString('uk-UA')}`,
      'Active Subscription Plan': planInfo.text,
      'Start_Date': formatDate(),
      'End_Date': formatDate(endDate),
      'Subscription Status': 'Paid',
    });

    console.log(`✅ Payment confirmed for user ${tgId}, order ${orderReference}`);
  } catch (error) {
    console.error('Error handling payment confirmation:', error.message);
    throw error;
  }
}

