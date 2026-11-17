const db = require('../config/db');
const env = require('../config/env');

const cfg = env.alerts;
const MAX_LISTED = 25; // tối đa số máy liệt kê trong 1 tin, phần còn lại ghi "và N thiết bị khác"

// Chỉ cảnh báo máy thật: bỏ Monitor (đi theo PC), máy DEMO-, máy đã bị vô hiệu trong AD
const ALERTABLE = `
  COALESCE(a.category, '') NOT ILIKE '%monitor%'
  AND COALESCE(a.hostname, '') NOT ILIKE 'DEMO-%'
  AND a.ad_enabled IS DISTINCT FROM FALSE`;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDuration(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d} ngày ${h} giờ` : `${d} ngày`;
  if (h > 0) return m ? `${h} giờ ${m} phút` : `${h} giờ`;
  return `${m} phút`;
}

const label = (a) => a.hostname || a.it_asset_code || `#${a.id}`;
const place = (a) => [a.node_name, a.production_line].filter(Boolean).join(' / ') || 'chưa gán vị trí';

function buildMessage(title, rows, lineFn, good = false) {
  const shown = rows.slice(0, MAX_LISTED);
  return { title, good, lines: shown.map(lineFn), more: rows.length - shown.length };
}

// ---------- Kênh gửi ----------

async function sendTeams(msg) {
  const body = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: msg.title, weight: 'Bolder', size: 'Medium', wrap: true, color: msg.good ? 'Good' : 'Attention' },
            ...msg.lines.map((t) => ({ type: 'TextBlock', text: t, wrap: true, spacing: 'Small' })),
            ...(msg.more > 0 ? [{ type: 'TextBlock', text: `… và ${msg.more} thiết bị khác`, isSubtle: true, wrap: true }] : []),
          ],
        },
      },
    ],
  };
  const res = await fetch(cfg.teamsWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

let transporter;
function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer'); // chỉ nạp khi thật sự dùng email
    transporter = nodemailer.createTransport({
      host: cfg.email.host,
      port: cfg.email.port,
      secure: cfg.email.secure,
      auth: cfg.email.user ? { user: cfg.email.user, pass: cfg.email.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

async function sendEmail(msg) {
  const more = msg.more > 0 ? `… và ${msg.more} thiết bị khác` : '';
  await getTransporter().sendMail({
    from: cfg.email.from,
    to: cfg.email.to.join(','),
    subject: msg.title,
    text: [msg.title, '', ...msg.lines, more].join('\n'),
    html: `<h3>${esc(msg.title)}</h3><ul>${msg.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${more ? `<p>${esc(more)}</p>` : ''}`,
  });
}

// Gửi qua mọi kênh đã cấu hình. Chỉ ném lỗi khi TẤT CẢ kênh đều thất bại.
async function dispatch(msg) {
  const tasks = [];
  if (cfg.teamsWebhook) tasks.push(['Teams', sendTeams(msg)]);
  if (cfg.email.configured) tasks.push(['Email', sendEmail(msg)]);
  const results = await Promise.allSettled(tasks.map(([, p]) => p));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? `${tasks[i][0]}: ${r.reason?.message || r.reason}` : null))
    .filter(Boolean);
  failed.forEach((f) => console.error('Gửi cảnh báo thất bại -', f));
  if (failed.length === tasks.length) throw new Error(failed.join('; '));
}

// ---------- Logic cảnh báo ----------

let warnedDisabled = false;

class AlertService {
  /** Gọi sau mỗi lượt kiểm tra online/offline. */
  async run() {
    if (!cfg.enabled) {
      if (!warnedDisabled) {
        console.warn('Chưa cấu hình TEAMS_WEBHOOK_URL hoặc SMTP_*/ALERT_EMAIL_*: bỏ qua cảnh báo offline.');
        warnedDisabled = true;
      }
      return { skipped: 'no-channel' };
    }

    const out = { offlineAlerted: 0, recovered: 0 };

    // 1) Máy mới offline: ghi mốc thời gian lần đầu hệ thống thấy nó offline
    await db.query(`UPDATE assets SET offline_since = NOW() WHERE status = 'offline' AND offline_since IS NULL`);

    // 2) Máy đã được báo offline và nay online lại -> báo phục hồi
    const rec = await db.query(
      `SELECT a.id, a.hostname, a.it_asset_code, a.production_line, a.offline_since, n.name AS node_name
       FROM assets a LEFT JOIN tree_nodes n ON n.id = a.node_id
       WHERE a.status = 'online' AND a.offline_alerted_at IS NOT NULL
       ORDER BY a.offline_since ASC`
    );
    if (rec.rows.length > 0) {
      const now = Date.now();
      await dispatch(
        buildMessage(
          `✅ ${rec.rows.length} thiết bị đã online trở lại`,
          rec.rows,
          (a) => `${label(a)} — ${place(a)} — đã offline ${fmtDuration(now - new Date(a.offline_since).getTime())}`,
          true
        )
      );
      await db.query(
        `UPDATE assets SET offline_since = NULL, offline_alerted_at = NULL WHERE id = ANY($1::bigint[])`,
        [rec.rows.map((r) => r.id)]
      );
      out.recovered = rec.rows.length;
    }

    // 3) Dọn mốc của máy không còn offline (vd: chuyển sang bảo trì).
    //    Nếu bước 2 gửi lỗi thì đã ném lỗi ra ngoài trước khi tới đây, lượt sau (5 phút) sẽ tự thử lại.
    await db.query(
      `UPDATE assets SET offline_since = NULL, offline_alerted_at = NULL
       WHERE status <> 'offline' AND (offline_since IS NOT NULL OR offline_alerted_at IS NOT NULL)`
    );

    // 4) Máy offline quá ngưỡng và chưa báo (hoặc đã đến hạn nhắc lại)
    const cand = await db.query(
      `SELECT a.id, a.hostname, a.it_asset_code, a.category, a.assigned_to, a.production_line,
              a.offline_since, n.name AS node_name
       FROM assets a LEFT JOIN tree_nodes n ON n.id = a.node_id
       WHERE a.status = 'offline'
         AND a.offline_since <= NOW() - make_interval(mins => $1::int)
         AND ${ALERTABLE}
         AND (a.offline_alerted_at IS NULL
              OR ($2::int > 0 AND a.offline_alerted_at <= NOW() - make_interval(hours => $2::int)))
       ORDER BY a.offline_since ASC`,
      [cfg.offlineAfterMin, cfg.repeatHours]
    );
    if (cand.rows.length > 0) {
      const now = Date.now();
      await dispatch(
        buildMessage(
          `⚠️ ${cand.rows.length} thiết bị offline quá ${fmtDuration(cfg.offlineAfterMin * 60000)}`,
          cand.rows,
          (a) =>
            `${label(a)}${a.category ? ` (${a.category})` : ''} — ${place(a)} — offline ${fmtDuration(now - new Date(a.offline_since).getTime())}` +
            (a.assigned_to ? ` — ${a.assigned_to}` : '')
        )
      );
      // Chỉ đánh dấu đã báo SAU khi gửi thành công; nếu lỗi thì lượt sau thử lại
      await db.query(`UPDATE assets SET offline_alerted_at = NOW() WHERE id = ANY($1::bigint[])`, [
        cand.rows.map((r) => r.id),
      ]);
      out.offlineAlerted = cand.rows.length;
    }

    return out;
  }

  async sendTest() {
    if (!cfg.enabled) throw new Error('Chưa cấu hình kênh cảnh báo (TEAMS_WEBHOOK_URL hoặc SMTP_*/ALERT_EMAIL_*)');
    await dispatch({
      title: '✅ Tin nhắn thử từ hệ thống quản lý tài sản',
      good: true,
      lines: ['Nếu bạn thấy tin này thì cấu hình cảnh báo đã hoạt động.'],
      more: 0,
    });
  }
}

module.exports = new AlertService();