const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');
const { upload } = require('../../config/cloudinary');
const {
  addProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  bulkActionProducts
} = require('../../controllers/admin/productController');

// Cấu hình multer xử lý 2 trường ảnh
const cpUpload = upload.fields([
  { name: 'staticImage', maxCount: 1 },
  { name: 'animatedImage', maxCount: 1 }
]);

// @route   GET /api/admin/products/list
// @desc    Get all products
// @access  Private (Admin Only)
router.get('/list', verifyToken, isAdmin, getAllProducts);

// @route   POST /api/admin/products
// @desc    Add new product
router.post('/', cpUpload, addProduct);

// @route   PUT /api/admin/products/bulk
// @desc    Perform bulk actions on products
// @access  Private (Admin Only)
router.put('/bulk', verifyToken, isAdmin, bulkActionProducts);

// @route   PUT /api/admin/products/:id
// @desc    Update a product
// @access  Private (Admin Only)
router.put('/:id', verifyToken, isAdmin, cpUpload, updateProduct);

// @route   DELETE /api/admin/products/:id
// @desc    Delete a product
// @access  Private (Admin Only)
router.delete('/:id', verifyToken, isAdmin, deleteProduct);

module.exports = router;
