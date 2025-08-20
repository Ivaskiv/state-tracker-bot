import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const reportService = {
  // Тижневий звіт
  async generateWeeklyReport(userTGId) {
    try {
      const records = await base("User Reflections")
        .select({
          filterByFormula: `{User ID}='${userTGId}'`,
          sort: [{ field: "Record DateTime", direction: "desc" }],
          maxRecords: 7,
        })
        .all();

      if (!records.length)
        return "❗ У тебе ще немає щоденних рефлексій за тиждень.";

      let report = "📊 Тижневий звіт твоїх рефлексій:\n\n";
      records.reverse().forEach((r, idx) => {
        report += `День ${idx + 1}:\n`;
        report += `🌟 Стан: ${r.fields.State || "-"}\n`;
        report += `⚡️ Енергія: +${r.fields["Energy Gain"] || "-"} / -${
          r.fields["Energy Loss"] || "-"
        }\n`;
        report += `🏆 Перемога: ${r.fields.Victory || "-"}\n`;
        report += `📝 Програми/Уроки: ${r.fields.Programs || "-"}\n\n`;
      });

      return report;
    } catch (err) {
      console.error("❌ Помилка при формуванні тижневого звіту:", err);
      return "❌ Не вдалося сформувати тижневий звіт.";
    }
  },

  // Місячний звіт
  async generateMonthlyReport(userTGId) {
    try {
      const records = await base("User Reflections")
        .select({
          filterByFormula: `{User ID}='${userTGId}'`,
          sort: [{ field: "Record DateTime", direction: "desc" }],
          maxRecords: 30,
        })
        .all();

      if (!records.length)
        return "❗ У тебе ще немає щоденних рефлексій за місяць.";

      let report = "📈 Місячний звіт твоїх рефлексій:\n\n";
      records.reverse().forEach((r, idx) => {
        report += `День ${idx + 1}:\n`;
        report += `🌟 Стан: ${r.fields.State || "-"}\n`;
        report += `⚡️ Енергія: +${r.fields["Energy Gain"] || "-"} / -${
          r.fields["Energy Loss"] || "-"
        }\n`;
        report += `🏆 Перемога: ${r.fields.Victory || "-"}\n`;
        report += `📝 Програми/Уроки: ${r.fields.Programs || "-"}\n\n`;
      });

      return report;
    } catch (err) {
      console.error("❌ Помилка при формуванні місячного звіту:", err);
      return "❌ Не вдалося сформувати місячний звіт.";
    }
  },
};

export default reportService;
