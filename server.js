// server.js
import express from 'express';
import dotenv from 'dotenv';
import { telegramBot } from './src/services/telegramBot.js';
import { startScheduler } from './src/services/schedulerService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Telegram Coach Bot is running!' });
});

// Start the bot
telegramBot.startPolling();
console.log('🤖 Telegram bot started');

// Start the scheduler for daily reminders
startScheduler();
console.log('⏰ Scheduler started');

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down bot...');
  telegramBot.stopPolling();
  process.exit(0);
});