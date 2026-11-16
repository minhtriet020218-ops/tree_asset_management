const ActiveDirectory = require('activedirectory2');

// Cấu hình kết nối tới Domain Controller của công ty
const adConfig = {
  url: 'ldap://dc.yourcompany.local', // Địa chỉ IP hoặc Domain Controller
  baseDN: 'DC=yourcompany,DC=local',  // Vùng chứa dữ liệu (Base DN)
  username: 'admin@yourcompany.local', // Tài khoản IT quản trị Domain
  password: 'your_domain_password'
};

const ad = new ActiveDirectory(adConfig);

class ADSyncService {
  // Hàm quét và lấy toàn bộ máy tính trong Domain
  async syncComputersToDatabase() {
    return new Promise((resolve, reject) => {
      // Truy vấn tìm tất cả các máy tính có trong Active Directory
      ad.findComputers('(&(objectCategory=computer))', (err, computers) => {
        if (err) {
          console.error('Lỗi kết nối Active Directory:', err);
          return reject(err);
        }

        if (!computers || computers.length === 0) {
          console.log('Không tìm thấy máy tính nào trong Domain.');
          return resolve([]);
        }

        // Duyệt qua danh sách máy tính lấy được từ Domain
        const parsedAssets = computers.map(comp => ({
          hostname: comp.cn, // Hostname của máy (ví dụ: VN26-PMC7033)
          description: comp.description || 'Synced from AD',
          os: comp.operatingSystem || 'Windows',
          last_logon: comp.lastLogonTimestamp
        }));

        console.log(`Đã đồng bộ thành công ${parsedAssets.length} thiết bị từ Domain.`);
        resolve(parsedAssets);
      });
    });
  }
}

module.exports = new ADSyncService();