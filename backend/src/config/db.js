const { Pool } = require('pg');
const env = require('./env'); // đọc từ file .env (đã kiểm tra đủ biến DB_*)

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  max: 10,                       // tối đa 10 kết nối cùng lúc
  idleTimeoutMillis: 30000,      // đóng kết nối rảnh sau 30 giây
  connectionTimeoutMillis: 5000, // chờ kết nối DB tối đa 5 giây
});

// Lỗi ở kết nối đang rảnh (vd: PostgreSQL khởi động lại) không được làm sập server
pool.on('error', (err) => console.error('Lỗi kết nối PostgreSQL:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
};