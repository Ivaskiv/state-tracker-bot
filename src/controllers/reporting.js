import { Telegraf, Markup } from 'telegraf';
import User from '../models/user.js';
import Record from '../models/record.js';
import * as analytics from '../services/analytics.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

async function sendReport(ctx, period = 'daily') {
  const telegramId = ctx.from.id;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start. 😊');

    const { startDate, endDate } = getPeriodDates(period);
    const records = await Record.find({ telegramId, timestamp: { $gte: startDate, $lt: endDate } }).sort({ timestamp: 1 });

    if (!records.length) {
      const periodText = {
        daily: 'сьогодні',
        weekly: 'останні 7 днів',
        monthly: 'місяць',
        all: 'весь період',
      }[period];
      return ctx.reply(`За ${periodText} ще немає записів. 🙁`);
    }

    const report = await analytics.generateReport(records, user, period);
    const formattedReport = formatReport(report, period);

    if (user.reportChannel === 'email') {
      await sendEmailReport(user.email, formattedReport);
      await ctx.reply('Звіт надіслано на ваш email! 📧');
    } else {
      await ctx.reply(formattedReport);
      await ctx.reply('Звіт успішно надіслано! 📬');
    }

    await sendPdfReport(ctx, formattedReport, period);
  } catch (err) {
    console.error('Error generating report:', err);
    await ctx.reply('Вибачте, сталася помилка при створенні звіту. 😞');
  }
}

// === ФОРМАТУВАННЯ ЗВІТУ ===
function formatReport(report, period) {
  const templates = {
    daily: `📊 Щоденний звіт\n\n📅 Твій день завершено!\n🔸 Найчастіший стан: ${report.mostFrequentState}\n🔸 Часті емоції: ${report.frequentEmotions.join(', ')}\n🔸 Потенційні тригери: ${report.triggers.join(', ')}\n🔸 AI-рекомендація: ${report.aiRecommendation}\n`,
    weekly: `📈 Звіт за тиждень:\n\n🔹 Ресурсні стани: ${report.resourcefulStates}%\n🔹 Емоції: ${report.emotions.join(', ')}\n🔹 Часті тригери: ${report.triggers.join(', ')}\n🔹 Краще працювало: ${report.bestWorks.join(', ')}\n🔸 Рекомендую: ${report.dailyRituals}\n`,
    monthly: `📈 Звіт за місяць:\n\n🔹 Ресурсні стани: ${report.resourcefulStates}%\n🔹 Емоції: ${report.emotions.join(', ')}\n🔹 Часті тригери: ${report.triggers.join(', ')}\n🔹 Краще працювало: ${report.bestWorks.join(', ')}\n🔸 Рекомендую: ${report.dailyRituals}\n`,
    all: `📊 Загальний звіт за весь період:\n\n🔸 Найчастіший стан: ${report.mostFrequentState}\n🔸 Часті емоції: ${report.frequentEmotions.join(', ')}\n🔸 Потенційні тригери: ${report.triggers.join(', ')}\n🔸 Краще працювало: ${report.bestWorks.join(', ')}\n🔸 AI-рекомендація: ${report.aiRecommendation}\n`,
  };
  return templates[period] || '';
}

// === ОТРИМАННЯ ДАТ ===
function getPeriodDates(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);

  const periodMap = {
    daily: () => ({ startDate: today, endDate: new Date(today.setDate(today.getDate() + 1)) }),
    weekly: () => ({ startDate: new Date(today.setDate(today.getDate() - 7)), endDate }),
    monthly: () => ({ startDate: new Date(today.setMonth(today.getMonth() - 1)), endDate }),
    all: () => ({ startDate: 0, endDate }),
  };

  if (!periodMap[period]) throw new Error('Invalid period specified.');
  return periodMap[period]();
}

// === PDF ===
function generatePdfReport(content, period) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, `report_${period}.pdf`);

    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(18).text(`Звіт за ${period}`, { align: 'center' });
    doc.moveDown().fontSize(12).text(content, { align: 'left' });
    doc.end();

    doc.on('finish', () => resolve(filePath));
    doc.on('error', reject);
  });
}

async function sendPdfReport(ctx, content, period) {
  try {
    const pdfPath = await generatePdfReport(content, period);
    await ctx.replyWithDocument({ source: pdfPath }, { caption: `Звіт за ${period}` });
    fs.unlinkSync(pdfPath);
  } catch (err) {
    console.error('PDF send error:', err);
    await ctx.reply('Не вдалося надіслати PDF звіт. 😞');
  }
}

// === НАЛАШТУВАННЯ ЗВІТІВ ===
async function setupReportSettings(ctx) {
  const telegramId = ctx.from.id;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start. 😊');

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Щодня', 'daily')],
      [Markup.button.callback('Щотижня', 'weekly')],
      [Markup.button.callback('Щомісяця', 'monthly')],
      [Markup.button.callback('Отримувати через Telegram', 'telegram')],
      [Markup.button.callback('Отримувати на Email', 'email')],
    ]);
    await ctx.reply('Оберіть період або канал для звітів:', keyboard);
  } catch (err) {
    console.error('Setup error:', err);
    await ctx.reply('Помилка при налаштуванні параметрів. 😞');
  }
}

async function handleReportSettings(ctx) {
  const telegramId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Спочатку потрібно зареєструватися. 😊');

    if (['daily', 'weekly', 'monthly'].includes(data)) {
      user.reportPeriod = data;
      await ctx.reply(`Період звітів встановлено: ${data}`);
    } else if (['telegram', 'email'].includes(data)) {
      user.reportChannel = data;
      await ctx.reply(`Канал для звітів встановлено: ${data === 'telegram' ? 'Telegram' : 'Email'}`);
    }
    await user.save();
  } catch (err) {
    console.error('Handle settings error:', err);
    await ctx.reply('Помилка при збереженні налаштувань. 😞');
  }
}

export {
  sendReport,
  setupReportSettings,
  handleReportSettings,
  sendPdfReport,
};

export const sendDailyReport = (ctx) => sendReport(ctx, 'daily');
export const sendWeeklyReport = (ctx) => sendReport(ctx, 'weekly');
export const sendMonthlyReport = (ctx) => sendReport(ctx, 'monthly');
export const sendAllTimeReport = (ctx) => sendReport(ctx, 'all');
