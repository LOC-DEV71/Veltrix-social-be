const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');
const {
  getAll,
  getFlat,
  getById,
  create,
  update,
  deleteCategory
} = require('../../controllers/admin/categoryController');

// Áp dụng middleware xác thực + phân quyền cho toàn bộ route category
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/categories       → Lấy toàn bộ danh mục dạng cây lồng nhau
router.get('/', getAll);

// GET /api/admin/categories/flat  → Lấy danh sách phẳng (dùng cho dropdown/select)
router.get('/flat', getFlat);

// GET /api/admin/categories/:id   → Lấy chi tiết một danh mục
router.get('/:id', getById);

// POST /api/admin/categories      → Tạo danh mục mới
router.post('/', create);

// PUT /api/admin/categories/:id   → Cập nhật danh mục (bao gồm đổi cha)
router.put('/:id', update);

// DELETE /api/admin/categories/:id?strategy=cascade|detach
// → Xóa danh mục kèm cây con (cascade) hoặc tách con thành root (detach)
router.delete('/:id', deleteCategory);

module.exports = router;
