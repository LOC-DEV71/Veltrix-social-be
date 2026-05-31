const Category = require('../../models/Category');
const Product = require('../../models/Product');
const { buildCategoryTree, getAllDescendantIds } = require('../../utils/categoryHelper');

// ─── Helper: Tự động tạo slug từ tên danh mục ──────────────────────────────
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')                         // Tách ký tự có dấu
    .replace(/[\u0300-\u036f]/g, '')          // Xóa dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')   // Xử lý chữ đ đặc biệt
    .replace(/[^a-z0-9\s-]/g, '')            // Xóa ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-')                     // Khoảng trắng → gạch ngang
    .replace(/-+/g, '-');                     // Nhiều gạch ngang liên tiếp → 1 gạch
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Lấy toàn bộ danh mục dạng cây phân cấp
// @route   GET /api/admin/categories
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    // Lấy toàn bộ category phẳng từ DB, populate tên category cha
    const allCategories = await Category.find({})
      .populate('parentId', 'name slug')
      .sort({ createdAt: 1 })
      .lean(); // Chuyển về plain JS object để có thể thêm field 'children'

    // Chuyển đổi mảng phẳng → cây phân cấp lồng nhau
    const categoryTree = buildCategoryTree(allCategories);

    res.status(200).json({
      success: true,
      total: allCategories.length,
      data: categoryTree
    });
  } catch (error) {
    console.error(`🔴 Get All Categories Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tải danh mục sản phẩm!'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Lấy danh mục dạng phẳng (dùng cho dropdown/select trong form)
// @route   GET /api/admin/categories/flat
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getFlat = async (req, res) => {
  try {
    const categories = await Category.find({})
      .populate('parentId', 'name')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      total: categories.length,
      data: categories
    });
  } catch (error) {
    console.error(`🔴 Get Flat Categories Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tải danh mục!'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Lấy chi tiết một danh mục theo ID
// @route   GET /api/admin/categories/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentId', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục này!'
      });
    }

    // Lấy danh sách con trực tiếp
    const children = await Category.find({ parentId: id }).lean();

    res.status(200).json({
      success: true,
      data: {
        ...category,
        children
      }
    });
  } catch (error) {
    console.error(`🔴 Get Category By ID Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tìm kiếm danh mục!'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Tạo danh mục mới
// @route   POST /api/admin/categories
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const create = async (req, res) => {
  try {
    const { name, description, parentId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục là bắt buộc!'
      });
    }

    // Tự sinh slug từ tên, đảm bảo unique bằng cách thêm timestamp nếu trùng
    let slug = generateSlug(name);
    const slugExists = await Category.findOne({ slug });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    // Kiểm tra parentId hợp lệ nếu được cung cấp
    if (parentId) {
      const parentExists = await Category.findById(parentId);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục cha không tồn tại!'
        });
      }
    }

    const category = await Category.create({
      name,
      slug,
      description: description || '',
      parentId: parentId || null
    });

    // Populate lại để trả về thông tin đầy đủ
    await category.populate('parentId', 'name slug');

    res.status(201).json({
      success: true,
      message: `Đã tạo danh mục "${name}" thành công!`,
      data: category
    });
  } catch (error) {
    console.error(`🔴 Create Category Error: ${error.message}`);
    // Lỗi unique constraint trên slug
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Slug danh mục đã tồn tại! Vui lòng đặt tên khác.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tạo danh mục!'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Cập nhật danh mục
// @route   PUT /api/admin/categories/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục là bắt buộc!'
      });
    }

    // Kiểm tra danh mục tồn tại
    const existing = await Category.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục cần cập nhật!'
      });
    }

    // Ngăn chặn vòng lặp: không cho phép đặt parentId của chính mình hoặc cháu của mình làm cha
    if (parentId && parentId.toString() === id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục không thể là cha của chính nó!'
      });
    }

    if (parentId) {
      // Lấy tất cả category để kiểm tra vòng lặp
      const allCategories = await Category.find({}).lean();
      const descendantIds = getAllDescendantIds(allCategories, id);
      const isDescendant = descendantIds.some(
        (descId) => descId.toString() === parentId.toString()
      );
      if (isDescendant) {
        return res.status(400).json({
          success: false,
          message: 'Không thể đặt danh mục con làm cha của danh mục hiện tại (sẽ tạo vòng lặp)!'
        });
      }

      // Kiểm tra parentId hợp lệ
      const parentExists = await Category.findById(parentId);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục cha không tồn tại!'
        });
      }
    }

    // Cập nhật slug nếu tên thay đổi
    let slug = existing.slug;
    if (name !== existing.name) {
      slug = generateSlug(name);
      const slugExists = await Category.findOne({ slug, _id: { $ne: id } });
      if (slugExists) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    const updated = await Category.findByIdAndUpdate(
      id,
      {
        name,
        slug,
        description: description ?? existing.description,
        parentId: parentId !== undefined ? (parentId || null) : existing.parentId
      },
      { new: true, runValidators: true }
    ).populate('parentId', 'name slug');

    res.status(200).json({
      success: true,
      message: `Đã cập nhật danh mục "${name}" thành công!`,
      data: updated
    });
  } catch (error) {
    console.error(`🔴 Update Category Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật danh mục!'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Xóa danh mục + toàn bộ cây con theo strategy được chọn
// @route   DELETE /api/admin/categories/:id?strategy=cascade|detach
//          strategy=cascade → Xóa luôn tất cả danh mục con (default)
//          strategy=detach  → Set parentId của danh mục con về null (thành root)
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = req.query.strategy || 'cascade'; // 'cascade' | 'detach'

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục cần xóa!'
      });
    }

    // Lấy toàn bộ category để tìm cây con
    const allCategories = await Category.find({}).lean();
    const descendantIds = getAllDescendantIds(allCategories, id);

    if (strategy === 'detach') {
      // Chiến lược: tách các con thành root (parentId = null)
      if (descendantIds.length > 0) {
        await Category.updateMany(
          { parentId: id },
          { $set: { parentId: null } }
        );
      }
      // Cập nhật products thuộc danh mục bị xóa về null
      await Product.updateMany({ category: id }, { $set: { category: null } });

    } else {
      // Chiến lược mặc định: cascade — xóa toàn bộ cây con
      if (descendantIds.length > 0) {
        await Category.deleteMany({ _id: { $in: descendantIds } });
        // Cập nhật products thuộc các danh mục con bị xóa
        await Product.updateMany(
          { category: { $in: descendantIds } },
          { $set: { category: null } }
        );
      }
      // Cập nhật products thuộc danh mục cha bị xóa
      await Product.updateMany({ category: id }, { $set: { category: null } });
    }

    // Xóa danh mục cha
    await Category.findByIdAndDelete(id);

    const deletedCount = strategy === 'cascade' ? 1 + descendantIds.length : 1;

    res.status(200).json({
      success: true,
      message: strategy === 'cascade'
        ? `Đã xóa danh mục "${category.name}" và ${descendantIds.length} danh mục con thành công!`
        : `Đã xóa danh mục "${category.name}". ${descendantIds.length > 0 ? `${descendantIds.length} danh mục con đã được tách thành danh mục gốc.` : ''}`,
      deletedCount
    });
  } catch (error) {
    console.error(`🔴 Delete Category Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xóa danh mục!'
    });
  }
};

module.exports = {
  getAll,
  getFlat,
  getById,
  create,
  update,
  deleteCategory
};
