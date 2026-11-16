const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tree_asset_db',
  password: '123', // Thay mật khẩu pgAdmin của bạn vào đây
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};