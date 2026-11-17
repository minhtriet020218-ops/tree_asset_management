require('dotenv').config();

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  process.exit(1);
}

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);
const adConfigured = ['AD_URL', 'AD_BASE_DN', 'AD_SERVICE_USER', 'AD_SERVICE_PASSWORD'].every((k) => process.env[k]);

// --- Cảnh báo (Teams webhook và/hoặc email) ---
const emailTo = (process.env.ALERT_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
const emailConfigured = Boolean(process.env.SMTP_HOST && process.env.ALERT_EMAIL_FROM && emailTo.length);
const teamsWebhook = (process.env.TEAMS_WEBHOOK_URL || '').trim();

module.exports = {
  port: num(process.env.PORT, 8080),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  db: {
    host: process.env.DB_HOST,
    port: num(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  ad: {
    configured: adConfigured,
    url: process.env.AD_URL,
    baseDN: process.env.AD_BASE_DN,
    username: process.env.AD_SERVICE_USER,
    password: process.env.AD_SERVICE_PASSWORD,
    defaultNodeId: process.env.AD_DEFAULT_NODE_ID ? num(process.env.AD_DEFAULT_NODE_ID, null) : null,
    syncOnStart: process.env.AD_SYNC_ON_START === 'true',
  },
  schedule: {
    adSync: process.env.SYNC_AD_CRON || '0 2 * * *',
    status: process.env.STATUS_CRON || '*/5 * * * *',
  },
  probe: {
    ports: (process.env.PROBE_PORTS || '445,135,3389,9100,80,443')
      .split(',').map((p) => Number(p.trim())).filter((p) => p > 0 && p < 65536),
    timeoutMs: num(process.env.PROBE_TIMEOUT_MS, 2000),
    concurrency: num(process.env.PROBE_CONCURRENCY, 100),
    offlineAfterFails: Math.max(1, num(process.env.OFFLINE_AFTER_FAILS, 2)),
    dnsSuffix: (process.env.HOST_DNS_SUFFIX || '').replace(/^\./, ''),
    dnsConcurrency: Math.max(1, num(process.env.DNS_CONCURRENCY, 3)),
    dnsTimeoutMs: num(process.env.DNS_TIMEOUT_MS, 3000),
  },
  alerts: {
    enabled: Boolean(teamsWebhook) || emailConfigured,
    offlineAfterMin: Math.max(1, num(process.env.ALERT_OFFLINE_MINUTES, 60)), // offline bao lâu thì báo
    repeatHours: Math.max(0, num(process.env.ALERT_REPEAT_HOURS, 24)),         // nhắc lại sau X giờ nếu vẫn offline (0 = không nhắc)
    teamsWebhook,
    email: {
      configured: emailConfigured,
      host: process.env.SMTP_HOST,
      port: num(process.env.SMTP_PORT, 587),
      secure: process.env.SMTP_SECURE === 'true', // true cho cổng 465
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
      from: process.env.ALERT_EMAIL_FROM,
      to: emailTo,
    },
  },
};