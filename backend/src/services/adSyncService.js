const fs = require('fs');
const ActiveDirectory = require('activedirectory2');
const env = require('../config/env');
const assetRepository = require('../repositories/assetRepository');

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

// Phải nêu rõ các trường cần lấy: nếu không, thư viện chỉ trả vài trường mặc định (có userAccountControl nhưng
// KHÔNG có operatingSystem, lastLogonTimestamp).
const COMPUTER_ATTRIBUTES = ['cn', 'dNSHostName', 'operatingSystem', 'description', 'lastLogonTimestamp', 'userAccountControl'];
const COMPUTER = '(objectCategory=computer)';
const PAGE_LIMIT = 1000; // AD trả tối đa chừng này kết quả cho mỗi truy vấn
const PREFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('');
const MAX_PREFIX_LEN = 10;

/**
 * Lấy hết kết quả của `search(filter)` dù AD giới hạn 1000 / truy vấn: chia theo tiền tố tên máy (cn).
 * Các nhánh không giao nhau: cn=<tiền tố><ký tự>* cho từng ký tự, cộng một nhánh "phần còn lại"
 * (tên đúng bằng tiền tố hoặc chứa ký tự lạ như khoảng trắng, dấu chấm).
 */
async function collectComputers(search, prefix = '') {
  const filter = prefix ? `(&${COMPUTER}(cn=${prefix}*))` : COMPUTER;
  const rows = await search(filter);
  if (rows.length < PAGE_LIMIT) return rows;
  if (prefix.length >= MAX_PREFIX_LEN) {
    console.warn(`AD: tiền tố "${prefix}" còn ${rows.length} máy, không chia nhỏ thêm được: có thể thiếu máy.`);
    return rows;
  }
  const out = [];
  for (const c of PREFIX_ALPHABET) out.push(...(await collectComputers(search, prefix + c)));
  const covered = PREFIX_ALPHABET.map((c) => `(cn=${prefix}${c}*)`).join('');
  const rest = await search(`(&${COMPUTER}(cn=${prefix}*)(!(|${covered})))`);
  if (rest.length >= PAGE_LIMIT) console.warn(`AD: nhánh còn lại của tiền tố "${prefix}" đạt ${rest.length} máy: có thể thiếu máy.`);
  out.push(...rest);
  return out;
}

// userAccountControl bit 2 (0x2) = ACCOUNTDISABLE
const isEnabled = (uac) => !(Number(uac) & 2);

class ADSyncService {
  _client() {
    const options = {
      url: env.ad.url,
      baseDN: env.ad.baseDN,
      username: env.ad.username,
      password: env.ad.password,
    };
    // Chứng chỉ LDAPS của DC do CA nội bộ cấp: Node mặc định không tin. Cho thêm CA, hoặc (chỉ để thử) bỏ kiểm tra.
    if (/^ldaps:/i.test(env.ad.url || '')) {
      const tlsOptions = {};
      if (env.ad.caFile) tlsOptions.ca = [fs.readFileSync(env.ad.caFile)];
      if (env.ad.tlsInsecure) tlsOptions.rejectUnauthorized = false;
      if (Object.keys(tlsOptions).length) options.tlsOptions = tlsOptions;
    }
    return new ActiveDirectory(options);
  }

  /**
   * Lấy toàn bộ máy tính (computer account) trong domain.
   * activedirectory2 không có findComputers: dùng find(), máy tính nằm trong results.other
   * (thư viện loại computer khỏi users / groups). find mặc định scope = 'base' nên phải đặt 'sub' để quét cả cây.
   *
   * AD chỉ trả tối đa 1000 kết quả mỗi truy vấn và phân trang của thư viện không đủ tin cậy, nên nếu một truy vấn
   * trả đủ 1000 thì tách nhỏ theo chữ cái đầu của tên máy (cn=a*, cn=b*, ...) cho tới khi mỗi truy vấn < 1000.
   * Domain nhỏ (< 1000 máy) vẫn chỉ tốn đúng 1 truy vấn như trước.
   */
  async fetchComputers() {
    const ad = this._client();
    const search = (filter) =>
      new Promise((resolve, reject) => {
        ad.find({ filter, scope: 'sub', timeLimit: 120, attributes: COMPUTER_ATTRIBUTES }, (err, results) => {
          if (err) return reject(err);
          // bộ lọc đã chỉ lấy computer, nên gộp cả 3 nhóm để không sót nếu thư viện phân loại khác đi
          resolve([...(results?.other || []), ...(results?.users || []), ...(results?.groups || [])]);
        });
      });
    return collectComputers(search);
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
module.exports.collectComputers = collectComputers; // để kiểm thử
