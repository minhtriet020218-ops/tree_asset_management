const net = require('net');
const dns = require('dns');
const env = require('../config/env');
const assetRepository = require('../repositories/assetRepository');

const { ports, timeoutMs, concurrency, offlineAfterFails, dnsSuffix, dnsConcurrency, dnsTimeoutMs } = env.probe;

// Tra DNS đúng 1 lần cho mỗi máy. dns.lookup chạy trên threadpool của Node (chỉ ~4 luồng),
// nên phải giới hạn số lượt song song, nếu không sẽ làm nghẽn cả kết nối tới PostgreSQL.
function lookupOnce(host) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), dnsTimeoutMs);
    dns.lookup(host, { family: 4 }, (err, address) => {
      clearTimeout(timer);
      resolve(err ? null : address);
    });
  });
}

// Thử kết nối TCP tới IP. ECONNREFUSED nghĩa là máy có phản hồi (chỉ đóng cổng đó) => coi là còn sống.
function tryPort(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', (err) => finish(err.code === 'ECONNREFUSED'));
    socket.connect(port, ip);
  });
}

// Online nếu BẤT KỲ cổng nào phản hồi (Windows PC: 445/135/3389, máy in: 9100/80/443...)
function probe(ip) {
  return new Promise((resolve) => {
    let pending = ports.length;
    if (pending === 0) return resolve(false);
    for (const p of ports) {
      tryPort(ip, p).then((ok) => {
        if (ok) resolve(true);
        else if (--pending === 0) resolve(false);
      });
    }
  });
}

const resolveHost = (hostname) =>
  dnsSuffix && !hostname.includes('.') ? `${hostname}.${dnsSuffix}` : hostname;

// Chạy fn trên mảng với giới hạn số tác vụ đồng thời
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

class StatusCheckService {
  async checkAll() {
    const assets = await assetRepository.listForStatusCheck();
    if (assets.length === 0) return { checked: 0, online: 0, offline: 0 };

    // Bước 1: tra DNS (ít luồng song song)
    const ips = await mapPool(assets, dnsConcurrency, (a) => lookupOnce(resolveHost(a.hostname.trim())));

    // Bước 2: kết nối TCP theo IP (không còn dùng DNS nên chạy song song nhiều được)
    const indexes = assets.map((_, i) => i);
    const results = await mapPool(indexes, concurrency, async (i) => ({
      id: assets[i].id,
      ok: ips[i] ? await probe(ips[i]) : false,
    }));

    const { online, offline } = await assetRepository.applyStatusResults(results, offlineAfterFails);
    await assetRepository.syncChildStatus(); // monitor đi theo trạng thái PC
    const reachable = results.filter((r) => r.ok).length;
    console.log(`Kiểm tra trạng thái: ${assets.length} thiết bị, phản hồi ${reachable}, không phản hồi ${assets.length - reachable}.`);
    return { checked: assets.length, reachable, online, offline };
  }
}

module.exports = new StatusCheckService();