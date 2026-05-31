const express = require('express');
const router = express.Router();
const { getAll, getById, create, update, deletePermission } = require('../../controllers/admin/permissionController');
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');

// Secure all permission management routes under verifyToken and isAdmin middlewares
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/permissions -> Get all permissions list
router.get('/', getAll);

// GET /api/admin/permissions/:id -> Get specific permission details
router.get('/:id', getById);

// POST /api/admin/permissions -> Create new permission key
router.post('/', create);

// PUT /api/admin/permissions/:id -> Update specific permission details
router.put('/:id', update);

// DELETE /api/admin/permissions/:id -> Remove permission key
router.delete('/:id', deletePermission);

module.exports = router;
