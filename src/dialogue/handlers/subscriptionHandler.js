// // handlers/subscriptionHandler.js
// import userService from '../services/userService.js';
// import { SUBSCRIPTION_PLANS } from '../config/constants.js';
// import { MESSAGES } from '../utils/messages.js';
// import { confirmSubscriptionKeyboard, mainMenuKeyboard } from '../utils/keyboards.js';
// import { v4 as uuidv4 } from 'uuid';

// class SubscriptionHandler {
//   async selectPlan(ctx, planType) {
//     try {
//       const plan = SUBSCRIPTION_PLANS[planType];
//       if (!plan) {
//         await ctx.reply('Невідомий план підписки');
//         return;
//       }

//       ctx.session.selectedPlan = {
//         type: planType,
//         ...plan
//       };

//       const message = MESSAGES.SUBSCRIPTION_SELECTED(plan.name, plan.price);
//       await ctx.editMessageText(message, confirmSubscriptionKeyboard(planType));
//     } catch (error) {
//       console.error('Error selecting plan:', error);
//       await ctx.reply(MESSAGES.ERROR_GENERIC);
//     }
//   }

//   async confirmPayment(ctx) {
//     try {
//       const match = ctx.callbackQuery.data.match(/confirm_(.+)/);
//       if (!match) return;

//       const planType = match[1];
//       const plan = SUBSCRIPTION_PLANS[planType];
//       const telegramId = ctx.from.id;
      
//       // Generate order reference
//       const orderReference = `ORDER_${Date.now()}_${telegramId}`;
      
//       // Create payment link (WayForPay integration)
//       const paymentLink = await this.createPaymentLink({
//         amount: plan.price,
//         orderReference,
//         productName: plan.name,
//         telegramId
//       });

//       await ctx.editMessageText(MESSAGES.PAYMENT_LINK(paymentLink));
      
//       // Store pending payment info
//       ctx.session.pendingPayment = {
//         planType,
//         orderReference,
//         amount: plan.price,
//         created: Date.now()
//       };

//       // Auto-activate subscription for demo (remove in production)
//       setTimeout(async () => {
//         await this.activateSubscription(telegramId, {
//           planName: plan.name,
//           planType,
//           duration: plan.duration,
//           amount: plan.price,
//           orderReference
//         });
        
//         try {
//           await ctx.telegram.sendMessage(
//             telegramId,
//             MESSAGES.SUBSCRIPTION_SUCCESS,
//             mainMenuKeyboard()
//           );
//         } catch (error) {
//           console.error('Error sending activation message:', error);
//         }
//       }, 5000); // 5 seconds for demo

//     } catch (error) {
//       console.error('Error confirming payment:', error);
//       await ctx.reply(MESSAGES.ERROR_PAYMENT);
//     }
//   }

//   async createPaymentLink(paymentData) {
//     try {
//       // In production, integrate with WayForPay API
//       // This is a mock implementation
//       const baseUrl = 'https://secure.wayforpay.com/pay';
//       const params = new URLSearchParams({
//         merchantAccount: process.env.WAYFORPAY_MERCHANT || 'demo_merchant',
//         orderReference: paymentData.orderReference,
//         orderDate: Math.floor(Date.now() / 1000),
//         amount: paymentData.amount,
//         currency: 'EUR',
//         productName: paymentData.productName,
//         productCount: 1,
//         productPrice: paymentData.amount,
//         returnUrl: `${process.env.WEBHOOK_URL}/payment-success`,
//         serviceUrl: `${process.env.WEBHOOK_URL}/payment-webhook`
//       });

//       // In production, add signature generation here
      
//       return `${baseUrl}?${params.toString()}`;
//     } catch (error) {
//       console.error('Error creating payment link:', error);
//       throw error;
//     }
//   }

//   async processPaymentWebhook(paymentData) {
//     try {
//       const { orderReference, transactionStatus } = paymentData;
      
//       if (transactionStatus === 'Approved') {
//         // Extract telegram ID from order reference
//         const telegramId = orderReference.split('_')[2];
        
//         if (telegramId) {
//           // Find plan type from pending payments or database
//           const user = await userService.getUserByTelegramId(telegramId);
          
//           if (user) {
//             // Activate subscription
//             await this.activateSubscription(telegramId, {
//               planName: paymentData.productName || 'Підписка',
//               amount: paymentData.amount,
//               orderReference,
//               paymentStatus: 'Paid'
//             });

//             console.log(`✅ Subscription activated for user ${telegramId}`);
//           }
//         }
//       }
      
//       return true;
//     } catch (error) {
//       console.error('Error processing payment webhook:', error);
//       return false;
//     }
//   }

//   async activateSubscription(telegramId, subscriptionData) {
//     try {
//       await userService.activateSubscription(telegramId, subscriptionData);
//       console.log(`✅ Subscription activated for user ${telegramId}`);
//     } catch (error) {
//       console.error('Error activating subscription:', error);
//       throw error;
//     }
//   }

//   async checkSubscriptionStatus(ctx) {
//     try {
//       const telegramId = ctx.from.id;
//       const user = await userService.getUserByTelegramId(telegramId);
      
//       if (!user) {
//         await ctx.reply('Користувач не знайдений');
//         return;
//       }

//       const subscriptionStatus = user.fields['Active_Subscription_Status'] || 'Немає підписки';
//       const activePlan = user.fields['Active Subscription Plan'] || 'Не вказано';
      
//       let message = `💰 СТАТУС ПІДПИСКИ\n\n`;
//       message += `📊 План: ${activePlan}\n`;
//       message += `📅 Статус: ${subscriptionStatus}\n`;

//       if (user.fields['End_Date']) {
//         const endDate = new Date(user.fields['End_Date']);
//         const today = new Date();
//         const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        
//         if (daysLeft > 0) {
//           message += `⏰ Днів залишилось: ${daysLeft}\n`;
//         }
//       }

//       await ctx.reply(message);
//     } catch (error) {
//       console.error('Error checking subscription status:', error);
//       await ctx.reply(MESSAGES.ERROR_GENERIC);
//     }
//   }

//   async renewSubscription(ctx, planType) {
//     try {
//       // Check if user has existing subscription
//       const telegramId = ctx.from.id;
//       const hasActive = await userService.hasActiveSubscription(telegramId);
      
//       if (hasActive) {
//         await ctx.reply('У тебе вже є активна підписка. Нова підписка буде активована після закінчення поточної.');
//       }

//       // Process renewal like new subscription
//       await this.selectPlan(ctx, planType);
//     } catch (error) {
//       console.error('Error renewing subscription:', error);
//       await ctx.reply(MESSAGES.ERROR_GENERIC);
//     }
//   }

//   async cancelSubscription(ctx) {
//     try {
//       const telegramId = ctx.from.id;
//       const user = await userService.getUserByTelegramId(telegramId);
      
//       if (!user) {
//         await ctx.reply('Користувач не знайдений');
//         return;
//       }

//       // Update subscription status to cancelled
//       await userService.updateUser(user.id, {
//         'Subscription Status': 'Cancelled'
//       });

//       await ctx.reply('❌ Підписка скасована. Ти можеш користуватися ботом до закінчення оплаченого періоду.');
//     } catch (error) {
//       console.error('Error cancelling subscription:', error);
//       await ctx.reply(MESSAGES.ERROR_GENERIC);
//     }
//   }

//   async extendSubscription(telegramId, days) {
//     try {
//       const user = await userService.getUserByTelegramId(telegramId);
//       if (!user) return false;

//       const currentEndDate = user.fields['End_Date'] ? 
//         new Date(user.fields['End_Date']) : 
//         new Date();
      
//       const newEndDate = new Date(currentEndDate);
//       newEndDate.setDate(newEndDate.getDate() + days);

//       await userService.updateUser(user.id, {
//         'End_Date': newEndDate.toISOString()
//       });

//       console.log(`✅ Subscription extended for user ${telegramId} by ${days} days`);
//       return true;
//     } catch (error) {
//       console.error('Error extending subscription:', error);
//       return false;
//     }
//   }

//   async getSubscriptionHistory(telegramId) {
//     try {
//       return await userService.getUserSubscriptions(telegramId);
//     } catch (error) {
//       console.error('Error getting subscription history:', error);
//       return [];
//     }
//   }

//   validatePaymentData(paymentData) {
//     const required = ['orderReference', 'amount', 'transactionStatus'];
    
//     for (const field of required) {
//       if (!paymentData[field]) {
//         return { valid: false, error: `Missing required field: ${field}` };
//       }
//     }

//     return { valid: true };
//   }

//   generateOrderReference(telegramId) {
//     const timestamp = Date.now();
//     const random = Math.random().toString(36).substr(2, 5);
//     return `ORDER_${timestamp}_${telegramId}_${random}`;
//   }
// }

// export default new SubscriptionHandler();