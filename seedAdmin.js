const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const Product = require('./models/Product');
const User = require('./models/User');
const Permission = require('./models/Permission');
const Role = require('./models/Role');
const Account = require('./models/Account');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('🔴 Lỗi: Không tìm thấy MONGO_URI trong file .env!');
  process.exit(1);
}

async function seed() {
  try {
    console.log('🔌 Đang kết nối tới cơ sở dữ liệu MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('🟢 Kết nối thành công!');

    // 1. Kiểm tra và Tạo các Quyền hạn chi tiết (Permissions) trước
    console.log('🔑 Đang khởi tạo các Permission hệ thống...');
    const defaultPermissions = [
      { name: 'views_products', description: 'Quyền xem danh sách các sản phẩm và khung avatar' },
      { name: 'create_products', description: 'Quyền đăng tải và thêm khung sản phẩm mới' },
      { name: 'update_products', description: 'Quyền cập nhật và sửa đổi thông tin khung sản phẩm' },
      { name: 'delete_products', description: 'Quyền gỡ bỏ sản phẩm khỏi cửa hàng' },
      { name: 'manage_users', description: 'Quyền quản lý thông tin thành viên (Users)' },
      { name: 'manage_roles', description: 'Quyền tạo lập và quản lý các vai trò (Roles) trong hệ thống' },
      { name: 'manage_permissions', description: 'Quyền định nghĩa và quản lý các phân quyền chi tiết (Permissions)' }
    ];

    const permissionIds = [];
    for (const p of defaultPermissions) {
      let perm = await Permission.findOne({ name: p.name });
      if (!perm) {
        perm = await Permission.create(p);
        console.log(`+ Đã tạo permission: ${p.name}`);
      }
      permissionIds.push(perm._id);
    }

    // 2. Kiểm tra Role 'Super Admin'
    console.log('🎭 Đang kiểm tra vai trò Super Admin...');
    let superAdminRole = await Role.findOne({ name: 'Super Admin' });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        name: 'Super Admin',
        permissions: permissionIds
      });
      console.log('⭐ Đã tạo mới vai trò: Super Admin');
    } else {
      // Cập nhật lại toàn bộ permissions mới nhất cho chắc chắn
      superAdminRole.permissions = permissionIds;
      await superAdminRole.save();
      console.log('⭐ Vai trò Super Admin đã tồn tại. Đã đồng bộ permissions!');
    }

    // 3. Kiểm tra Account 'admin@gmail.com'
    console.log('👤 Đang kiểm tra tài khoản Admin...');
    let adminAccount = await Account.findOne({ email: 'admin@gmail.com' });
    if (!adminAccount) {
      // Mã hóa mật khẩu '123456' bằng bcrypt
      const hashedPassword = await bcrypt.hash('123456', 10);
      
      adminAccount = await Account.create({
        username: 'SuperAdmin',
        email: 'admin@gmail.com',
        password: hashedPassword,
        role: superAdminRole._id,
        isActive: true
      });
      console.log('🎉 ĐÃ TẠO TÀI KHOẢN ADMIN THÀNH CÔNG!');
      console.log('=============================================');
      console.log(`📧 Email đăng nhập: ${adminAccount.email}`);
      console.log('🔑 Mật khẩu: 123456');
      console.log('=============================================');
    } else {
      // Đồng bộ lại mật khẩu mới để đề phòng lỗi so khớp cũ
      const hashedPassword = await bcrypt.hash('123456', 10);
      adminAccount.password = hashedPassword;
      adminAccount.role = superAdminRole._id;
      await adminAccount.save();
      console.log('ℹ️ Tài khoản admin@gmail.com đã tồn tại. Đã đồng bộ hóa mật khẩu và phân quyền!');
    }

    // 4. Tạo thêm 1 User demo cho Client nếu bảng User trống
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const userPasswordHashed = await bcrypt.hash('123456', 10);
      await User.create({
        username: 'MinhKhangClient',
        email: 'user@gmail.com',
        password: userPasswordHashed,
        coins: 1000,
        isPremium: false,
        role: 'user',
        ownedFrames: [],
        activeFrame: null
      });
      console.log('🎉 Đã tạo thêm 1 User demo client: user@gmail.com / 123456');
    }

  } catch (error) {
    console.error('🔴 Đã xảy ra lỗi trong quá trình seed dữ liệu:', error);
  } finally {
    console.log('🔌 Đóng kết nối cơ sở dữ liệu...');
    await mongoose.connection.close();
    console.log('🏁 Hoàn tất!');
    process.exit(0);
  }
}

seed();
