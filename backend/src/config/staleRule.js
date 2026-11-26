const env = require('./env');

/**
 * Điều kiện SQL "máy AD cũ, không theo dõi": không kiểm tra mạng, không cảnh báo, không tính vào số liệu online/offline.
 *  - Tài khoản máy bị vô hiệu hóa trong AD.
 *  - Máy lấy từ AD, chưa được IT đưa vào line nào, và có ngày đăng nhập cuối đã quá AD_STALE_DAYS ngày.
 *    Chưa biết ngày đăng nhập (ad_last_logon rỗng) thì KHÔNG coi là cũ: không đủ căn cứ để bỏ qua.
 *    Máy đã được gán vào line thì vẫn theo dõi vì IT đã chủ động biên chế nó.
 * Máy tạo tay (không lấy từ AD) không bao giờ bị coi là "cũ".
 * AD_STALE_DAYS=0: chỉ loại máy bị vô hiệu hóa, bỏ qua tiêu chí đăng nhập.
 *
 * alias: tên bảng trong câu SQL ('' nếu không dùng alias).
 */
function staleCondition(alias = 'a') {
  const p = alias ? `${alias}.` : '';
  const days = Math.max(0, Math.trunc(Number(env.probe.staleDays) || 0)); // số nguyên đã kiểm tra, an toàn để ghép vào SQL
  const disabled = `(${p}ad_synced_at IS NOT NULL AND ${p}ad_enabled IS FALSE)`;
  if (days === 0) return disabled;
  const inactive =
    `(${p}ad_synced_at IS NOT NULL AND COALESCE(${p}production_line, '') = '' ` +
    `AND ${p}ad_last_logon < NOW() - make_interval(days => ${days}))`;
  return `(${disabled} OR ${inactive})`;
}

module.exports = { staleCondition };
