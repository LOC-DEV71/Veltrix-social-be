const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Account = require('../models/Account');
const Ban = require('../models/Ban');

// @desc    Verify JWT authorization token from Cookie (or Bearer fallback)
const verifyToken = async (req, res, next) => {
  try {
    let token;

    // Detect if the request path belongs to admin API
    const isAdminApi = req.originalUrl.includes('/api/admin');
    console.log(`[DEBUG verifyToken] req.originalUrl: ${req.originalUrl}, isAdminApi: ${isAdminApi}`);

    // Try reading token directly from cookies
    if (req.cookies) {
      token = isAdminApi ? req.cookies.adminToken : req.cookies.clientToken;
      console.log(`[DEBUG verifyToken] token from cookie:`, token ? 'Found' : 'Missing');
    }

    // Fallback to Header Authorization Bearer token (for developer flexibility)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log(`[DEBUG verifyToken] token from Bearer header:`, token ? 'Found' : 'Missing');
    }

    if (!token) {
      console.log(`[DEBUG verifyToken] No token found in both cookie and header!`);
      return res.status(401).json({
        status: 'error',
        message: 'Truy cập bị từ chối! Chưa cung cấp mã token JWT xác thực.'
      });
    }

    // Verify JWT payload signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    console.log(`[DEBUG verifyToken] decoded:`, decoded);

    // Check account collections depending on namespace / flag
    if (isAdminApi || decoded.isAdminAccount) {
      // Find staff account inside Account collection and populate roles/permissions
      console.log(`[DEBUG verifyToken] Admin route or Admin token detected. Checking Account collection...`);
      const account = await Account.findById(decoded.id || decoded._id).populate({
        path: 'role',
        populate: {
          path: 'permissions'
        }
      });
      if (!account || !account.isActive) {
        console.log(`[DEBUG verifyToken] Admin account not found or inactive!`);
        return res.status(401).json({
          status: 'error',
          message: 'Tài khoản quản trị không tồn tại hoặc đã bị khóa!'
        });
      }
      req.user = account;
    } else {
      // Find regular client user profile inside User collection
      console.log(`[DEBUG verifyToken] Checking User collection...`);
      const user = await User.findById(decoded.id || decoded._id);
      if (!user) {
        console.log(`[DEBUG verifyToken] User not found!`);
        return res.status(401).json({
          status: 'error',
          message: 'Người dùng không tồn tại!'
        });
      }
      req.user = user;
    }

    // NEW: Check if the user is banned
    if (!isAdminApi) {
      const clientIp = req.ip || req.connection.remoteAddress;
      const banRecord = await Ban.findOne({
        $or: [
          { email: req.user.email },
          { ipAddress: clientIp }
        ]
      });

      if (banRecord || req.user.isBanned) {
        // If they are banned but somehow the banRecord was deleted, default to generic message
        const reason = banRecord ? banRecord.reason : 'Vi phạm chính sách hệ thống';
        const banType = banRecord ? banRecord.banType : 'both';
        
        // Save to cookies so frontend can read it
        res.cookie('isBanned', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 });
        res.cookie('banReason', encodeURIComponent(reason), { maxAge: 365 * 24 * 60 * 60 * 1000 });
        res.cookie('banType', banType, { maxAge: 365 * 24 * 60 * 60 * 1000 });

        // Clear the login token
        res.clearCookie('clientToken');

        return res.status(403).json({
          success: false,
          isBanned: true,
          banType,
          message: `Tài khoản hoặc IP của bạn đã bị cấm truy cập. Lý do: ${reason}`
        });
      }
    }

    console.log(`[DEBUG verifyToken] Authentication successful!`);

    next();
  } catch (error) {
    console.error(`🔴 Auth Middleware Error: ${error.message}`);
    return res.status(401).json({
      status: 'error',
      message: 'Token xác thực không hợp lệ hoặc đã hết hạn!'
    });
  }
};

// @desc    Check if user holds administrative role permissions
const isAdmin = (req, res, next) => {
  // Account model role is populated as an object, User model role is a string
  const roleName = req.user && req.user.role && typeof req.user.role === 'object'
    ? req.user.role.name
    : req.user ? req.user.role : null;

  const validAdminRoles = ['admin', 'Super Admin', 'Product Manager'];
  if (roleName && validAdminRoles.includes(roleName)) {
    next();
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'Quyền truy cập bị từ chối! Yêu cầu tài khoản Quản trị viên.'
    });
  }
};

module.exports = {
  verifyToken,
  isAdmin
};
