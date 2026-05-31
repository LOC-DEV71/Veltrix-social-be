const express = require('express');
const router = express.Router();
const { login, getMe, logout } = require('../../controllers/admin/adminAuthController');
const { verifyToken } = require('../../middleware/authMiddleware');

// POST /api/admin/auth/login (Public)
router.post('/login', login);

// POST /api/admin/auth/logout (Public)
router.post('/logout', logout);

// GET /api/admin/auth/me (Private - requires valid token)
router.get('/me', verifyToken, getMe);

module.exports = router;
