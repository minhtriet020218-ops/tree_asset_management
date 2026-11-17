// Chạy: node --test backend/test   (không cần database: db/env/repository được giả lập)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const src = (p) => path.join(__dirname, '..', 'src', p);

// ----- giả lập module -----
let queries = [];
let treeRows = [];
const fakeDb = {
  query: async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM tree_nodes/.test(sql)) return { rows: treeRows };
    if (/next_hostname/.test(sql)) {
      const [branch, year, line] = params;
      return { rows: [{ hostname: `${branch}${String(year % 100).padStart(2, '0')}-${line}-001` }] };
    }
    return { rows: [] };
  },
};
const created = [];
const fakeRepo = { create: async (d, opts) => { created.push({ d, opts }); return { id: 1, ...d }; } };

function load(id, exports) {
  const file = require.resolve(src(id));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
load('config/db.js', fakeDb);
load('config/env.js', { alerts: { newAssetGraceDays: 7 } });
load('repositories/assetRepository.js', fakeRepo);

const hostnameService = require(src('services/hostnameService.js'));
const assetService = require(src('services/assetService.js'));

// cây: Công ty > Nhà máy HCM > Xưởng > Line SMT01   (rows xếp từ node chọn lên gốc, như SQL trả về)
const chain = (leaf) => [
  leaf,
  { name: 'Xưởng A', code: 'WS-A', node_type: 'workshop' },
  { name: 'Nhà máy HCM', code: 'hcm', node_type: 'plant' },
  { name: 'Công ty', code: 'CORP', node_type: 'company' },
];

test('lấy mã chi nhánh = plant gần nhất, line = node line', async () => {
  treeRows = chain({ name: 'Line SMT 01', code: 'SMT-01', node_type: 'line' });
  assert.deepEqual(await hostnameService.resolveCodes(5), { branch: 'hcm', line: 'SMT-01' });
});

test('chọn node không phải line thì dùng chính node đó làm line', async () => {
  treeRows = chain({ name: 'Kho', code: 'KHO', node_type: 'zone' });
  assert.deepEqual(await hostnameService.resolveCodes(5), { branch: 'hcm', line: 'KHO' });
});

test('không có plant thì rơi về company', async () => {
  treeRows = [
    { name: 'Line 1', code: 'L1', node_type: 'line' },
    { name: 'Công ty', code: 'CORP', node_type: 'company' },
  ];
  assert.deepEqual(await hostnameService.resolveCodes(5), { branch: 'CORP', line: 'L1' });
});

test('node chưa có code -> lỗi 400 nêu tên node', async () => {
  treeRows = chain({ name: 'Line X', code: '', node_type: 'line' });
  await assert.rejects(hostnameService.resolveCodes(5), (e) => e.status === 400 && /Line X/.test(e.message));
});

test('node không tồn tại -> 400', async () => {
  treeRows = [];
  await assert.rejects(hostnameService.resolveCodes(99), (e) => e.status === 400);
});

test('generate: thiếu node_id -> 400', async () => {
  await assert.rejects(hostnameService.generate(undefined), (e) => e.status === 400);
  await assert.rejects(hostnameService.generate(''), (e) => e.status === 400);
});

test('generate: truyền năm đầy đủ cho hàm SQL', async () => {
  treeRows = chain({ name: 'Line SMT 01', code: 'SMT01', node_type: 'line' });
  queries = [];
  const h = await hostnameService.generate(5);
  const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
  assert.equal(h, `hcm${yy}-SMT01-001`); // SQL thật sẽ viết hoa; ở đây chỉ kiểm tra tham số truyền xuống
  const call = queries.find((q) => /next_hostname/.test(q.sql));
  assert.equal(call.params[1], new Date().getFullYear());
});

test('createAsset: PC để trống hostname -> tự sinh, kèm thời gian ân hạn', async () => {
  treeRows = chain({ name: 'Line SMT 01', code: 'SMT01', node_type: 'line' });
  created.length = 0;
  await assetService.createAsset({ node_id: 5, category: 'PC', hostname: '   ' });
  assert.match(created[0].d.hostname, /^hcm\d{2}-SMT01-001$/);
  assert.equal(created[0].opts.graceDays, 7);
});

test('createAsset: giữ nguyên hostname người dùng nhập', async () => {
  created.length = 0;
  await assetService.createAsset({ node_id: 5, category: 'PC', hostname: 'OLD-PC-01' });
  assert.equal(created[0].d.hostname, 'OLD-PC-01');
});

test('createAsset: Monitor không sinh hostname', async () => {
  created.length = 0;
  await assetService.createAsset({ node_id: 5, category: 'Monitor', hostname: '' });
  assert.ok(!created[0].d.hostname);
  created.length = 0;
  await assetService.createAsset({ node_id: 5, category: 'Màn hình', hostname: '' });
  assert.ok(!created[0].d.hostname);
});

test('createAsset: PC không có node_id -> 400', async () => {
  await assert.rejects(assetService.createAsset({ category: 'PC' }), (e) => e.status === 400);
});
