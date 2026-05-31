const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');
const { getAllUsers, addCoinsToUser, banUser, getBans, unbanUser } = require('../../controllers/admin/userController');

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin Only)
router.get('/', verifyToken, isAdmin, getAllUsers);

// @route   POST /api/admin/users/:id/coins
// @desc    Add coins to user
// @access  Private (Admin Only)
router.post('/:id/coins', verifyToken, isAdmin, addCoinsToUser);

// @route   POST /api/admin/users/:id/ban
// @desc    Ban a user
// @access  Private (Admin Only)
router.post('/:id/ban', verifyToken, isAdmin, banUser);

// @route   GET /api/admin/users/bans/list
// @desc    Get all banned users/IPs
// @access  Private (Admin Only)
router.get('/bans/list', verifyToken, isAdmin, getBans);

// @route   DELETE /api/admin/users/bans/:id
// @desc    Unban a user/IP
// @access  Private (Admin Only)
router.delete('/bans/:id', verifyToken, isAdmin, unbanUser);

module.exports = router;
