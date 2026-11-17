const db = require('../config/db');

/**
 * Hostname = {CHI_NHÁNH}{YY}-{LINE}-{STT}   vd: HCM26-SMT01-007
 * Mã lấy từ cột `code` của cây tree_nodes, đi ngược từ node được chọn lên gốc.
 * Muốn đổi cách map loại node -> chi nhánh / line thì chỉ sửa 2 hằng số dưới đây.
 */
const BRANCH_TYPES = ['plant', 'company']; // chi nhánh = node 'plant' gần nhất, không có thì 'company'
const LINE_TYPES = ['line'];               // line = node 'line' gần nhất, không có thì chính node được chọn

const bad = (message) => Object.assign(new Error(message), { status: 400 });

async function resolveCodes(nodeId) {
  const { rows } = await db.query(
    `WITH RECURSIVE up AS (
       SELECT id, parent_id, name, code, node_type, 0 AS depth FROM tree_nodes WHERE id = $1::bigint
       UNION ALL
       SELECT t.id, t.parent_id, t.name, t.code, t.node_type, up.depth + 1
       FROM tree_nodes t JOIN up ON t.id = up.parent_id
     )
     SELECT name, code, node_type FROM up ORDER BY depth`,
    [nodeId]
  );
  if (rows.length === 0) throw bad('Không tìm thấy vị trí (node) đã chọn');

  // rows đã xếp từ node được chọn lên gốc => find() trả về node gần nhất
  const nearest = (types) => {
    for (const type of types) {
      const hit = rows.find((r) => r.node_type === type);
      if (hit) return hit;
    }
    return null;
  };

  const branch = nearest(BRANCH_TYPES);
  const line = nearest(LINE_TYPES) || rows[0];
  if (!branch) throw bad('Không tìm thấy node chi nhánh (plant/company) phía trên vị trí đã chọn');
  if (!String(branch.code || '').trim()) throw bad(`Node "${branch.name}" chưa có mã (code) nên không đặt được hostname`);
  if (!String(line.code || '').trim()) throw bad(`Node "${line.name}" chưa có mã (code) nên không đặt được hostname`);

  return { branch: branch.code, line: line.code };
}

/** Cấp hostname tiếp theo cho node (số thứ tự cấp nguyên tử ở phía DB, xem next_hostname trong 004_*.sql). */
async function generate(nodeId) {
  if (nodeId === undefined || nodeId === null || nodeId === '' || Number.isNaN(Number(nodeId))) {
    throw bad('Cần chọn vị trí (node) để hệ thống tự đặt hostname');
  }
  const { branch, line } = await resolveCodes(Number(nodeId));
  const year = new Date().getFullYear();
  const { rows } = await db.query('SELECT next_hostname($1::text, $2::int, $3::text) AS hostname', [branch, year, line]);
  return rows[0].hostname;
}

module.exports = { generate, resolveCodes };
