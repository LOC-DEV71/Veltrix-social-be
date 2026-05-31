const Permission = require('../../models/Permission');

// @desc    Get all permissions list
// @route   GET /api/admin/permissions
// @access  Private (Admin Role-Based check)
const getAll = async (req, res) => {
  try {
    const permissions = await Permission.find({}).sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error(`🔴 Get All Permissions Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách quyền hạn!'
    });
  }
};

// @desc    Get permission by ID
// @route   GET /api/admin/permissions/:id
// @access  Private (Admin Role-Based check)
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền hạn này!'
      });
    }
    res.status(200).json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error(`🔴 Get Permission By ID Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tìm kiếm thông tin quyền hạn!'
    });
  }
};

// @desc    Create a new permission
// @route   POST /api/admin/permissions
// @access  Private (Admin Role-Based check)
const create = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp cả Tên Quyền (name) và Mô Tả (description)!'
      });
    }

    // Check if permission already exists
    const exists = await Permission.findOne({ name });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Quyền hạn này đã được khai báo trên hệ thống!'
      });
    }

    const permission = await Permission.create({ name, description });
    
    res.status(201).json({
      success: true,
      message: 'Khởi tạo Quyền Hạn mới thành công!',
      data: permission
    });
  } catch (error) {
    console.error(`🔴 Create Permission Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Không thể khởi tạo quyền hạn mới!'
    });
  }
};

// @desc    Update a permission
// @route   PUT /api/admin/permissions/:id
// @access  Private (Admin Role-Based check)
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: name và description!'
      });
    }

    const permission = await Permission.findByIdAndUpdate(
      id,
      { name, description },
      { new: true, runValidators: true }
    );

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền hạn cần cập nhật!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật quyền hạn thành công!',
      data: permission
    });
  } catch (error) {
    console.error(`🔴 Update Permission Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật quyền hạn!'
    });
  }
};

// @desc    Delete a permission
// @route   DELETE /api/admin/permissions/:id
// @access  Private (Admin Role-Based check)
const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.findByIdAndDelete(id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền hạn cần xóa!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã gỡ bỏ quyền hạn khỏi hệ thống thành công!'
    });
  } catch (error) {
    console.error(`🔴 Delete Permission Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi gỡ bỏ quyền hạn!'
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deletePermission
};
