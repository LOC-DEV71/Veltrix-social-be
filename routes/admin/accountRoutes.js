const express = require('express');
const router = express.Router();
const { getAll, getById, create, update, deleteAccount } = require('../../controllers/admin/accountController');
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');

// Secure all account management routes under verifyToken and isAdmin middlewares
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/accounts -> Get all admin staff accounts
router.get('/', getAll);

// GET /api/admin/accounts/:id -> Get specific admin staff account details
router.get('/:id', getById);

// POST /api/admin/accounts -> Create a new admin staff account
router.post('/', create);

// PUT /api/admin/accounts/:id -> Update specific admin staff account details
router.put('/:id', update);

// DELETE /api/admin/accounts/:id -> Remove admin staff account
router.delete('/:id', deleteAccount);

module.exports = router;
