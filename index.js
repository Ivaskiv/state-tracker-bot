import 'dotenv/config';
import express from 'express';
import { bot } from './src/bot.js';
import { initScheduler } from './src/utils/scheduler.js';

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/bot${process.env.TELEGRAM_TOKEN}`;

// ===== Перевірка змінних середовища =====
['TELEGRAM_TOKEN', 'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'WEBHOOK_URL'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`${key} не визначено.`);
    process.exit(1);
  }
});

// ===== Middleware =====
app.use(express.json());
app.post(WEBHOOK_PATH, async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Помилка обробки оновлення:', err);
    res.sendStatus(500);
  }
});

// ===== Запуск сервера та Webhook =====
(async () => {
  app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущено на порті ${PORT}`);

    const webhookUrl = `${process.env.WEBHOOK_URL}${WEBHOOK_PATH}`;
    try {
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook встановлено: ${webhookUrl}`);
    } catch (err) {
      console.error('❌ Помилка встановлення Webhook:', err);
    }

    // Ініціалізація scheduler
    initScheduler(bot);
  });
})();

// ===== Очистка Webhook при завершенні =====
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
