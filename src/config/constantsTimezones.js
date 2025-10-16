//src/config/constantsTimezones.js
// ===== ЧАСОВІ ЗОНИ =====
export const TIMEZONES = [
  { label: 'Europe/Kyiv (UTC+3)', slug: 'Europe/Kyiv' },
  { label: 'Europe/Warsaw (UTC+2)', slug: 'Europe/Warsaw' },
  { label: 'Europe/Berlin (UTC+2)', slug: 'Europe/Berlin' },
  { label: 'Europe/London (UTC+1)', slug: 'Europe/London' },
  { label: 'Europe/Paris (UTC+2)', slug: 'Europe/Paris' },
  { label: 'Europe/Rome (UTC+2)', slug: 'Europe/Rome' },
  { label: 'Europe/Vienna (UTC+2)', slug: 'Europe/Vienna' },
  { label: 'Europe/Stockholm (UTC+2)', slug: 'Europe/Stockholm' },
  { label: 'Europe/Moscow (UTC+3)', slug: 'Europe/Moscow' },
  { label: 'Asia/Dubai (UTC+4)', slug: 'Asia/Dubai' },
  { label: 'America/New_York (UTC-4)', slug: 'America/New_York' },
  { label: 'America/Chicago (UTC-5)', slug: 'America/Chicago' },
  { label: 'America/Los_Angeles (UTC-7)', slug: 'America/Los_Angeles' },
  { label: 'Canada/Toronto (UTC-4)', slug: 'Canada/Toronto' },
  { label: 'Asia/Tokyo (UTC+9)', slug: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (UTC+8)', slug: 'Asia/Shanghai' },
  { label: 'Australia/Sydney (UTC+10)', slug: 'Australia/Sydney' },
  { label: 'Europe/Prague (UTC+2)', slug: 'Europe/Prague' },
  { label: 'Europe/Bucharest (UTC+3)', slug: 'Europe/Bucharest' },
  { label: 'Europe/Helsinki (UTC+3)', slug: 'Europe/Helsinki' },
];

export const getTzLabel = (slug) => {
  const tz = TIMEZONES.find(t => t.slug === slug);
  return tz ? tz.label : `${slug} (UTC+0)`;
};

export const parseTz = getTzLabel;
