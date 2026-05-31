const bcrypt = require('bcrypt');
const Account = require('../../models/Account');

// @desc    Get all administrative accounts
// @route   GET /api/admin/accounts
// @access  Private (Admin Role-Based check)
const getAll = async (req, res) => {
  try {
    const accounts = await Account.find({}, '-password')
      .populate({
        path: 'role',
        populate: {
          path: 'permissions'
        }
      })
      .sort({ username: 1 });

    res.status(200).json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error(`🔴 Get Accounts Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách tài khoản nội bộ!'
    });
  }
};

// @desc    Get administrative account by ID
// @route   GET /api/admin/accounts/:id
// @access  Private (Admin Role-Based check)
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await Account.findById(id, '-password')
      .populate({
        path: 'role',
        populate: {
          path: 'permissions'
        }
      });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản quản trị này!'
      });
    }

    res.status(200).json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error(`🔴 Get Account By ID Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tìm kiếm thông tin tài khoản!'
    });
  }
};

// @desc    Create a new administrative account
// @route   POST /api/admin/accounts
// @access  Private (Admin Role-Based check)
const create = async (req, res) => {
  try {
    const { username, email, password, role, isActive } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: username, email, password, và vai trò (role)!'
      });
    }

    // Check if account already exists
    const emailExists = await Account.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được đăng ký cho tài khoản nội bộ khác!'
      });
    }

    const usernameExists = await Account.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập (username) này đã tồn tại!'
      });
    }

    // Hash the administrative password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const account = await Account.create({
      username,
      email,
      password: hashedPassword,
      role,
      isActive: isActive !== undefined ? isActive : true
    });

    // Populate role details for returned object
    const populatedAccount = await Account.findById(account._id, '-password')
      .populate({
        path: 'role',
        populate: {
          path: 'permissions'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Khởi tạo Tài Khoản Quản Trị mới thành công!',
      data: populatedAccount
    });
  } catch (error) {
    console.error(`🔴 Create Account Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Không thể khởi tạo tài khoản quản trị mới!'
    });
  }
};

// @desc    Update an administrative account
// @route   PUT /api/admin/accounts/:id
// @access  Private (Admin Role-Based check)
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role, isActive } = req.body;

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản quản trị cần cập nhật!'
      });
    }

    // Check email uniqueness if email has changed
    if (email && email !== account.email) {
      const emailExists = await Account.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email này đã được đăng ký bởi một tài khoản khác!'
        });
      }
      account.email = email;
    }

    // Check username uniqueness if username has changed
    if (username && username !== account.username) {
      const usernameExists = await Account.findOne({ username });
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: 'Tên đăng nhập (username) đã được sử dụng!'
        });
      }
      account.username = username;
    }

    // Update password if a new one is provided (with bcrypt hashing)
    if (password) {
      const saltRounds = 10;
      account.password = await bcrypt.hash(password, saltRounds);
    }

    if (role) {
      account.role = role;
    }

    if (isActive !== undefined) {
      account.isActive = isActive;
    }

    await account.save();

    // Populate role details for returned object
    const populatedAccount = await Account.findById(account._id, '-password')
      .populate({
        path: 'role',
        populate: {
          path: 'permissions'
        }
      });

    res.status(200).json({
      success: true,
      message: 'Cập nhật tài khoản quản trị thành công!',
      data: populatedAccount
    });
  } catch (error) {
    console.error(`🔴 Update Account Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật tài khoản quản trị!'
    });
  }
};

// @desc    Delete an administrative account
// @route   DELETE /api/admin/accounts/:id
// @access  Private (Admin Role-Based check)
const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent administrative suicide
    if (req.user && req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không được phép tự xóa tài khoản của chính mình!'
      });
    }

    const account = await Account.findByIdAndDelete(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản quản trị cần xóa!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã gỡ bỏ tài khoản quản trị khỏi hệ thống thành công!'
    });
  } catch (error) {
    console.error(`🔴 Delete Account Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi gỡ bỏ tài khoản quản trị!'
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteAccount
};
