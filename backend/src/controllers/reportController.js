const db = require('../config/db');
const ExcelJS = require('exceljs');

exports.exportAssetsExcel = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM assets ORDER BY id ASC');
    const assets = result.rows;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asset Report');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Serial Number', key: 'serial_number', width: 25 },
      { header: 'MAC Address', key: 'mac_address', width: 20 },
      { header: 'Hostname', key: 'hostname', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Line Name', key: 'line_name', width: 20 },
      { header: 'Last Seen', key: 'last_seen_at', width: 25 },
    ];

    assets.forEach((asset) => {
      sheet.addRow(asset);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + 'Asset_Report_' + Date.now() + '.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to export excel file' });
  }
};