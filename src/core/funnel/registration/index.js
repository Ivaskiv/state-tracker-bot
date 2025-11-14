// src/features/registration/index.js
import * as handlers from './handlers.js';

export default function initRegistration(bot) {
  bot.start(handlers.handleStart);
  
  bot.action('use_telegram_name', handlers.handleUseTelegramName);
  bot.action('enter_custom_name', handlers.handleEnterCustomName);
  bot.action('skip_email', handlers.handleSkipEmail);
  bot.action('skip_phone', handlers.handleSkipPhone);
  
  bot.on('text', handlers.handleTextInput);
}