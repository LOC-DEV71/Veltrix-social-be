const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Account = require('../../models/Account');
const { getCookieOptions, getClearCookieOptions } = require('../../utils/cookieOptions');

// @desc    Admin staff login
// @route   POST /api/admin/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ cả Email và Mật khẩu quản trị!'
      });
    }

    // Find administrative account and populate role with its nested permission list
    const account = await Account.findOne({ email, isActive: true })
      .populate({
        path: 'role',
        populate: {
          path: 'permissions'
        }
      });

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản quản trị không tồn tại hoặc đã bị khóa!'
      });
    }

    // Compare hashed password via bcrypt
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu quản trị không chính xác!'
      });
    }

    // Extract list of permission keys (e.g. ['update_products', 'create_products'])
    const permissionKeys = account.role && account.role.permissions 
      ? account.role.permissions.map(p => p.name)
      : [];

    // Sign JWT access token with administrative payload
    const token = jwt.sign(
      { 
        id: account._id, 
        username: account.username, 
        role: account.role ? account.role.name : 'No Role',
        permissions: permissionKeys,
        isAdminAccount: true // flag to distinguish from normal client User model tokens
      },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' } // 24-hour expiration for security compliance
    );

    // Save token inside HttpOnly secure cookie
    res.cookie('adminToken', token, getCookieOptions({ maxAge: 24 * 60 * 60 * 1000 }));


    res.status(200).json({
      success: true,
      message: `Đăng nhập quản trị thành công! Xin chào ${account.username}.`,
      token,
      data: {
        _id: account._id,
        username: account.username,
        email: account.email,
        role: account.role,
        permissions: permissionKeys,
        isActive: account.isActive
      }
    });

  } catch (error) {
    console.error(`🔴 Admin Auth Login Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi xử lý đăng nhập quản trị!'
    });
  }
};

// @desc    Get current admin profile info
// @route   GET /api/admin/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập quản trị đã hết hạn hoặc không hợp lệ!'
      });
    }

    // Return account without password field
    const accountData = req.user.toObject ? req.user.toObject() : req.user;
    delete accountData.password;

    res.status(200).json({
      success: true,
      data: accountData
    });
  } catch (error) {
    console.error(`🔴 Get Admin Profile Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy thông tin tài khoản quản trị!'
    });
  }
};

// @desc    Admin staff logout
// @route   POST /api/admin/auth/logout
// @access  Public
const logout = async (req, res) => {
  res.clearCookie('adminToken', getClearCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Đã đăng xuất tài khoản quản trị thành công!'
  });
};

module.exports = {
  login,
  getMe,
  logout
};
