const express = require('express');
const { bot } = require('./src/bot.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bot.webhookCallback(`/bot${process.env.TELEGRAM_TOKEN}`));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
});

// Встановлення Webhook
bot.telegram.setWebhook(`https://your-app-name.onrender.com/bot${process.env.TELEGRAM_TOKEN}`);
