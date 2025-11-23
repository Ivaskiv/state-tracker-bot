// src/features/registration/index.js
import { startHandler, nameActions, textHandler } from './handlers.js';

export default function initOnboarding(bot) {  
  // Handlers
  bot.start(startHandler);
  bot.action('use_telegram_name', nameActions.use_telegram_name);
  bot.action('enter_custom_name', nameActions.enter_custom_name);
  bot.action('skip_email', nameActions.skip_email);
  bot.action('skip_phone', nameActions.skip_phone);
  bot.on('text', textHandler);

}