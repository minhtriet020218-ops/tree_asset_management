const ActiveDirectory = require('activedirectory2');
const env = require('../config/env');
const assetRepository = require('../repositories/assetRepository');

const ATTRIBUTES = [
  'cn', 'dNSHostName', 'operatingSystem', 'description',
  'lastLogonTimestamp', 'userAccountControl',
];

// AD trả lastLogonTimestamp dạng FILETIME (số lần 100ns kể từ 1601-01-01) hoặc đã parse sẵn thành Date
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (/^\d{15,}$/.test(s)) {
    const ms = Number(BigInt(s) / 10000n) - 11644473600000;
    return ms > 0 && ms < 4102444800000 ? new Date(ms) : null; // loại 0 và giá trị "never" (max int64)
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// userAccountControl bit 2 (0x2) = ACCOUNTDISABLE
const isEnabled = (uac) => !(Number(uac) & 2);

class ADSyncService {
  _client() {
    return new ActiveDirectory({
      url: env.ad.url,
      baseDN: env.ad.baseDN,
      username: env.ad.username,
      password: env.ad.password,
    });
  }

  fetchComputers() {
    const ad = this._client();
    return new Promise((resolve, reject) => {
      ad.findComputers(
        { filter: '(objectCategory=computer)', attributes: ATTRIBUTES, paged: true },
        (err, computers) => {
          if (err) return reject(err);
          resolve(computers || []);
        }
      );
    });
  }

  async syncComputersToDatabase() {
    if (!env.ad.configured) {
      throw new Error('Chưa cấu hình AD_URL / AD_BASE_DN / AD_SERVICE_USER / AD_SERVICE_PASSWORD');
    }

    const raw = await this.fetchComputers();

    // Không bao giờ coi "AD trả về rỗng" là dữ liệu hợp lệ: tránh làm hỏng DB khi AD lỗi
    if (raw.length === 0) {
      console.warn('AD không trả về máy tính nào, bỏ qua lượt đồng bộ.');
      return { fetched: 0, inserted: 0, updated: 0 };
    }

    // Loại trùng theo hostname (không phân biệt hoa/thường) để upsert không lỗi
    const byName = new Map();
    for (const c of raw) {
      const hostname = (c.cn || '').trim();
      if (!hostname) continue;
      byName.set(hostname.toLowerCase(), {
        hostname,
        os: c.operatingSystem || null,
        description: c.description || null,
        lastLogon: toDate(c.lastLogonTimestamp),
        enabled: isEnabled(c.userAccountControl),
      });
    }
    const computers = [...byName.values()];

    const { inserted, updated } = await assetRepository.upsertFromAD(computers, env.ad.defaultNodeId);
    console.log(`Đồng bộ AD: ${computers.length} máy (thêm mới ${inserted}, cập nhật ${updated}).`);
    return { fetched: computers.length, inserted, updated };
  }
}

module.exports = new ADSyncService();