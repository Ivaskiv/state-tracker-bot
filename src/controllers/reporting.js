import { Telegraf } from 'telegraf';
import User from '../models/user.js';
import Record from '../models/record.js';
import * as analytics from '../services/analytics.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Markup } from 'telegraf';

// Загальна функція для отримання звітів (щоденний, тижневий, місячний, загальний)
async function sendReport(ctx, period = 'daily') {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start. 😊');
    }

    const { startDate, endDate } = getPeriodDates(period);
    const records = await Record.find({
      telegramId,
      timestamp: { $gte: startDate, $lt: endDate }
    }).sort({ timestamp: 1 });

    if (records.length === 0) {
      return ctx.reply(`За ${period === 'daily' ? 'сьогодні' : period === 'weekly' ? 'останні 7 днів' : period === 'monthly' ? 'місяць' : 'весь період'} ще немає записів. 🙁`);
    }

    const report = await analytics.generateReport(records, user, period);
    const formattedReport = formatReport(report, period);

    if (user.reportChannel === 'email') {
      // Надсилання звіту через Email
      await sendEmailReport(user.email, formattedReport);
      await ctx.reply('Звіт надіслано на ваш email! 📧');
    } else {
      // Надсилання звіту через Telegram
      await ctx.reply(formattedReport);
      await ctx.reply('Звіт успішно надіслано! 📬');
    }
    
    // Створення та надсилання PDF
    await sendPdfReport(ctx, formattedReport, period);

  } catch (err) {
    console.error('Error generating report:', err);
    await ctx.reply('Вибачте, сталася помилка при створенні звіту. Спробуйте знову пізніше. 😞');
  }
}

// Форматування звіту
function formatReport(report, period) {
  if (period === 'daily') {
    return `
📊 Щоденний звіт

📅 Твій день завершено!
🔸 Найчастіший стан: ${report.mostFrequentState}
🔸 Часті емоції: ${report.frequentEmotions.join(', ')}
🔸 Потенційні тригери: ${report.triggers.join(', ')}
🔸 AI-рекомендація: ${report.aiRecommendation}

    `;
  } else if (period === 'weekly' || period === 'monthly') {
    return `
📈 Звіт за ${period === 'weekly' ? 'тиждень' : 'місяць'}:

🔹 Ресурсні стани: ${report.resourcefulStates}%
🔹 Емоції: ${report.emotions.join(', ')}
🔹 Часті тригери: ${report.triggers.join(', ')}
🔹 Краще працювало: ${report.bestWorks.join(', ')}
🔸 Рекомендую: ${report.dailyRituals}

    `;
  } else if (period === 'all') {
    return `
📊 Загальний звіт за весь період:

🔸 Найчастіший стан: ${report.mostFrequentState}
🔸 Часті емоції: ${report.frequentEmotions.join(', ')}
🔸 Потенційні тригери: ${report.triggers.join(', ')}
🔸 Краще працювало: ${report.bestWorks.join(', ')}
🔸 AI-рекомендація: ${report.aiRecommendation}

    `;
  }
  return '';
}

// Отримання дат для звітів
function getPeriodDates(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === 'daily') {
    return { startDate: today, endDate: new Date(today).setDate(today.getDate() + 1) };
  } else if (period === 'weekly') {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { startDate: weekAgo, endDate: today };
  } else if (period === 'monthly') {
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return { startDate: monthAgo, endDate: today };
  } else if (period === 'all') {
    return { startDate: 0, endDate: today }; // Всі дані з початку часу
  } else {
    throw new Error('Invalid period specified.');
  }
}

// Генерація PDF файлу
function generatePdfReport(reportContent, period) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, `report_${period}.pdf`);
    
    doc.pipe(fs.createWriteStream(filePath));

    // Заголовок
    doc.fontSize(18).text(`Звіт за ${period === 'daily' ? 'День' : period === 'weekly' ? 'Тиждень' : 'Місяць'}`, { align: 'center' });

    // Вміст звіту
    doc.fontSize(12).text(reportContent, {
      align: 'left',
      continued: true,
      indent: 20,
    });

    // Завершення
    doc.end();

    // Повертаємо шлях до файлу
    doc.on('finish', () => resolve(filePath));
    doc.on('error', (err) => reject(err));
  });
}

// Функція для надсилання звіту через Telegram (включаючи PDF)
async function sendPdfReport(ctx, formattedReport, period) {
  try {
    const pdfFilePath = await generatePdfReport(formattedReport, period);
    
    await ctx.replyWithDocument({ source: pdfFilePath }, { caption: `Звіт за ${period === 'daily' ? 'День' : period === 'weekly' ? 'Тиждень' : 'Місяць'}` });
    
    // Видалити PDF після надсилання
    fs.unlinkSync(pdfFilePath);
  } catch (error) {
    console.error('Error sending PDF:', error);
    await ctx.reply('Не вдалося надіслати PDF звіт. 😞');
  }
}

// Команда для налаштування параметрів звіту
async function setupReportSettings(ctx) {
  const telegramId = ctx.from.id;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start. 😊');
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Щодня', 'daily')],
      [Markup.button.callback('Щотижня', 'weekly')],
      [Markup.button.callback('Щомісяця', 'monthly')],
      [Markup.button.callback('Отримувати через Telegram', 'telegram')],
      [Markup.button.callback('Отримувати на Email', 'email')],
    ]);
    
    await ctx.reply('Оберіть період для звітів або канал зв\'язку:', keyboard);
  } catch (err) {
    console.error('Error setting up report settings:', err);
    await ctx.reply('Вибачте, сталася помилка при налаштуванні параметрів. 😞');
  }
}

// Обробка натискання кнопок для налаштувань
async function handleReportSettings(ctx) {
  const telegramId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start. 😊');
    }

    if (['daily', 'weekly', 'monthly'].includes(callbackData)) {
      // Вибір періоду
      user.reportPeriod = callbackData;
      await user.save();
      await ctx.reply(`Вибрано період: ${callbackData === 'daily' ? 'Щодня' : callbackData === 'weekly' ? 'Щотижня' : 'Щомісяця'}`);
    } else if (['telegram', 'email'].includes(callbackData)) {
      // Вибір каналу зв'язку
      user.reportChannel = callbackData;
      await user.save();
      await ctx.reply(`Вибрано канал для звітів: ${callbackData === 'telegram' ? 'Telegram' : 'Email'}`);
    }
  } catch (err) {
    console.error('Error handling report settings:', err);
    await ctx.reply('Вибачте, сталася помилка при збереженні налаштувань. 😞');
  }
}

// Відправка щоденного звіту
async function sendDailyReport(ctx) {
  try {
    await sendReport(ctx, 'daily');
  } catch (error) {
    await ctx.reply('Не вдалося надіслати щоденний звіт. 😔');
  }
}

// Відправка тижневого звіту
async function sendWeeklyReport(ctx) {
  try {
    await sendReport(ctx, 'weekly');
  } catch (error) {
    await ctx.reply('Не вдалося надіслати тижневий звіт. 😔');
  }
}

// Відправка місячного звіту
async function sendMonthlyReport(ctx) {
  try {
    await sendReport(ctx, 'monthly');
  } catch (error) {
    await ctx.reply('Не вдалося надіслати місячний звіт. 😔');
  }
}

// Відправка загального звіту за весь період
async function sendAllTimeReport(ctx) {
  try {
    await sendReport(ctx, 'all');
  } catch (error) {
    await ctx.reply('Не вдалося надіслати загальний звіт. 😔');
  }
}


export {
  sendReport,
  sendDailyReport,
  sendWeeklyReport,
  sendMonthlyReport,
  sendAllTimeReport,
  setupReportSettings,
  handleReportSettings,
  sendPdfReport,
};
