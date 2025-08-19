// server.js
import express from 'express';
import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';

// Import services and handlers
import './src/config/database.js';
import botController from './src/controllers/botController.js';
import { setupScheduler } from './src/services/schedulerService.js';
import errorHandler from './src/middleware/errorHandler.js';

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware
app.use(express.json());
app.use(errorHandler);

// Session middleware for bot
bot.use(session({
  defaultSession: () => ({
    step: null,
    tempData: {},
    questionType: null,
    currentQuestion: 0
  })
}));

// Initialize bot handlers
botController(bot);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Webhook endpoint for Telegram
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Payment webhook
app.post('/payment-webhook', (req, res) => {
  // WayForPay webhook handler
  console.log('Payment webhook received:', req.body);
  res.sendStatus(200);
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  try {
    if (process.env.NODE_ENV === 'production') {
      // Set webhook for production
      await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
      console.log('✅ Webhook set successfully');
    } else {
      // Start polling for development
      bot.launch();
      console.log('✅ Bot started in polling mode');
    }
    
    // Initialize cron jobs
    setupScheduler();
    console.log('✅ Scheduler initialized');
    
  } catch (error) {
    console.error('❌ Error starting bot:', error);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));