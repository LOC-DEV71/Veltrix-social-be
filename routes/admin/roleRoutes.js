const express = require('express');
const router = express.Router();
const { getAll, getById, create, update, deleteRole } = require('../../controllers/admin/roleController');
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');

// Secure all role management routes under verifyToken and isAdmin middlewares
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/roles -> Get all roles
router.get('/', getAll);

// GET /api/admin/roles/:id -> Get specific role details
router.get('/:id', getById);

// POST /api/admin/roles -> Create a new role group
router.post('/', create);

// PUT /api/admin/roles/:id -> Update specific role name and permissions
router.put('/:id', update);

// DELETE /api/admin/roles/:id -> Remove a role group
router.delete('/:id', deleteRole);

module.exports = router;
