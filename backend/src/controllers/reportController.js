const ExcelJS = require('exceljs');
const db = require('../config/db');
const assetRepository = require('../repositories/assetRepository');

const VALID_STATUS = ['online', 'offline', 'maintenance'];

// Chặn Excel formula injection: ô bắt đầu bằng = + - @ (và không phải số) sẽ bị Excel hiểu là công thức
const safe = (v) => {
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) && Number.isNaN(Number(v)) ? `'${v}` : v;
};

const pad = (n) => String(n).padStart(2, '0');
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const COLUMNS = [
  { header: 'Mã tài sản (IT)', key: 'it_asset_code', width: 16 },
  { header: 'Hostname', key: 'hostname', width: 24 },
  { header: 'Loại thiết bị', key: 'category', width: 14 },
  { header: 'Sản phẩm / Model', key: 'product', width: 24 },
  { header: 'Serial Number', key: 'serial_number', width: 22 },
  { header: 'MAC Address', key: 'mac_address', width: 20 },
  { header: 'Trạng thái', key: 'status', width: 14 },
  { header: 'Vị trí (Node)', key: 'node_name', width: 24 },
  { header: 'Production Line', key: 'production_line', width: 20 },
  { header: 'Người sử dụng', key: 'assigned_to', width: 22 },
  { header: 'Mã nhân viên', key: 'staff_code', width: 14 },
  { header: 'Email', key: 'mail_user', width: 28 },
  { header: 'Phòng ban', key: 'department', width: 16 },
  { header: 'Mã tài sản kế toán', key: 'finance_asset_code', width: 18 },
  { header: 'PO / Invoice', key: 'po_invoice', width: 16 },
  { header: 'Gắn vào PC', key: 'parent', width: 24 },
  { header: 'Hệ điều hành', key: 'os', width: 26 },
  { header: 'Lần cuối online', key: 'last_seen_at', width: 20 },
  { header: 'ID', key: 'id', width: 8 },
];

exports.exportAssetsExcel = async (req, res) => {
  try {
    const { node_id, status, search, include_children } = req.query;

    if (node_id && !/^\d+$/.test(String(node_id))) {
      return res.status(400).json({ success: false, message: 'node_id không hợp lệ' });
    }
    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status phải là một trong: ${VALID_STATUS.join(', ')}`,
      });
    }

    // Dùng lại bộ lọc của trang danh sách (gồm cả node con, trừ khi include_children=false)
    const [rows, nodeRes] = await Promise.all([
      assetRepository.findAll(node_id, status, search, include_children !== 'false'),
      db.query('SELECT id, name FROM tree_nodes'),
    ]);

    const nodeName = new Map(nodeRes.rows.map((n) => [n.id, n.name]));
    const label = new Map(rows.map((a) => [a.id, a.hostname || a.it_asset_code || `#${a.id}`]));
    const assets = [...rows].sort((a, b) => a.id - b.id);

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Asset Report', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = COLUMNS;

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
    header.alignment = { vertical: 'middle' };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

    for (const a of assets) {
      const row = {};
      for (const c of COLUMNS) row[c.key] = safe(a[c.key]);
      row.node_name = nodeName.get(a.node_id) || '';
      row.parent = a.parent_asset_id ? label.get(a.parent_asset_id) || `#${a.parent_asset_id}` : '';
      sheet.addRow(row);
    }
    sheet.getColumn('last_seen_at').numFmt = 'yyyy-mm-dd hh:mm';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="Asset_Report_${stamp()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Không xuất được file Excel' });
    } else {
      res.end();
    }
  }
};