const Role = require('../../models/Role');

// @desc    Get all administrative roles
// @route   GET /api/admin/roles
// @access  Private (Admin Role-Based check)
const getAll = async (req, res) => {
  try {
    const roles = await Role.find({})
      .populate('permissions')
      .sort({ name: 1 });
      
    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error(`🔴 Get All Roles Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách vai trò!'
    });
  }
};

// @desc    Get role by ID
// @route   GET /api/admin/roles/:id
// @access  Private (Admin Role-Based check)
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id).populate('permissions');
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vai trò này!'
      });
    }
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error(`🔴 Get Role By ID Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tìm kiếm thông tin vai trò!'
    });
  }
};

// @desc    Create a new administrative role
// @route   POST /api/admin/roles
// @access  Private (Admin Role-Based check)
const create = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Tên Vai Trò (name)!'
      });
    }

    // Check if role already exists
    const exists = await Role.findOne({ name });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Vai trò này đã được khai báo trên hệ thống!'
      });
    }

    const role = await Role.create({
      name,
      permissions: permissions || []
    });

    // Populate permissions for the returned data
    const populatedRole = await Role.findById(role._id).populate('permissions');

    res.status(201).json({
      success: true,
      message: 'Khởi tạo Vai Trò mới thành công!',
      data: populatedRole
    });
  } catch (error) {
    console.error(`🔴 Create Role Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Không thể khởi tạo vai trò mới!'
    });
  }
};

// @desc    Update a role
// @route   PUT /api/admin/roles/:id
// @access  Private (Admin Role-Based check)
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: name!'
      });
    }

    const role = await Role.findByIdAndUpdate(
      id,
      { name, permissions: permissions || [] },
      { new: true, runValidators: true }
    ).populate('permissions');

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vai trò cần cập nhật!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật vai trò thành công!',
      data: role
    });
  } catch (error) {
    console.error(`🔴 Update Role Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật vai trò!'
    });
  }
};

// @desc    Delete a role
// @route   DELETE /api/admin/roles/:id
// @access  Private (Admin Role-Based check)
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vai trò cần xóa!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã gỡ bỏ vai trò khỏi hệ thống thành công!'
    });
  } catch (error) {
    console.error(`🔴 Delete Role Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi gỡ bỏ vai trò!'
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteRole
};
