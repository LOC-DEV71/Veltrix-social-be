const User = require('../../models/User');
const Ban = require('../../models/Ban');

// @desc    Get all registered users in MongoDB
// @route   GET /api/admin/users
// @access  Private (Admin Only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .populate('ownedFrames')
      .populate('activeFrame')
      .select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error(`🔴 Admin Get Users Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách người dùng!'
    });
  }
};

// @desc    Add coins to a specific user
// @route   POST /api/admin/users/:id/coins
// @access  Private (Admin Only)
const addCoinsToUser = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập số lượng Coin hợp lệ (lớn hơn 0)!'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng!'
      });
    }

    user.coins += Number(amount);
    await user.save();

    res.status(200).json({
      success: true,
      message: `Đã cộng thêm ${amount} Coin cho tài khoản ${user.username}!`,
      data: user
    });
  } catch (error) {
    console.error(`🔴 Admin Add Coins Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật Coin!'
    });
  }
};

// @desc    Ban a specific user (adds to Ban list by email and IP)
// @route   POST /api/admin/users/:id/ban
// @access  Private (Admin Only)
const banUser = async (req, res) => {
  try {
    const { reason, banType } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng!' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Không thể cấm tài khoản Quản trị viên!' });
    }

    // Determine ban attributes based on type
    let emailToBan = null;
    let ipToBan = null;

    if (banType === 'email' || banType === 'both') {
      emailToBan = user.email;
    }
    if (banType === 'ip' || banType === 'both') {
      ipToBan = user.lastIp || null;
    }

    // Add to Ban list
    const newBan = await Ban.create({
      email: emailToBan,
      ipAddress: ipToBan,
      banType: banType || 'both',
      reason: reason || 'Vi phạm chính sách hệ thống',
      bannedBy: req.user.username || 'Admin'
    });

    // Update user status
    user.isBanned = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Đã cấm tài khoản ${user.username} thành công!`,
      data: newBan
    });
  } catch (error) {
    console.error(`🔴 Admin Ban User Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cấm người dùng!' });
  }
};

// @desc    Get all active bans
// @route   GET /api/admin/users/bans/list
// @access  Private (Admin Only)
const getBans = async (req, res) => {
  try {
    const bans = await Ban.find({}).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: bans.length,
      data: bans
    });
  } catch (error) {
    console.error(`🔴 Admin Get Bans Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách cấm!' });
  }
};

// @desc    Unban an email/user
// @route   DELETE /api/admin/users/bans/:id
// @access  Private (Admin Only)
const unbanUser = async (req, res) => {
  try {
    const ban = await Ban.findById(req.params.id);
    if (!ban) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lệnh cấm này!' });
    }

    // Restore user status if user still exists
    if (ban.email) {
      await User.findOneAndUpdate({ email: ban.email }, { isBanned: false });
    } else if (ban.ipAddress) {
      await User.updateMany({ lastIp: ban.ipAddress }, { isBanned: false });
    }

    await ban.deleteOne();

    res.status(200).json({
      success: true,
      message: `Đã gỡ lệnh cấm thành công!`
    });
  } catch (error) {
    console.error(`🔴 Admin Unban Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi khi gỡ lệnh cấm!' });
  }
};

module.exports = {
  getAllUsers,
  addCoinsToUser,
  banUser,
  getBans,
  unbanUser
};
