const express = require('express');
const router = express.Router();

// Import individual route files
const authRoutes = require('./authRoutes');
const shopRoutes = require('./shopRoutes');
const friendRoutes = require('./friendRoutes');
const webrtcRoutes = require('./webrtcRoutes');

// Import profile controller for backwards compatibility
const { getUserProfile } = require('../../controllers/client/shopController');

// 🟢 Authentication routes -> /api/auth/login, /api/auth/register
router.use('/auth', authRoutes);

// 🟢 Products list route -> GET /api/products
router.use('/', shopRoutes);

// 🟢 Shop buy route -> POST /api/shop/buy (routes POST /buy in shopRoutes under /shop namespace)
router.use('/shop', shopRoutes);

// 🟢 User profile route -> GET /api/users/profile
router.get('/users/profile', getUserProfile);

// 🟢 User inventory route -> GET /api/users/inventory
const { getUserInventory } = require('../../controllers/client/shopController');
const { verifyToken } = require('../../middleware/authMiddleware');
router.get('/users/inventory', verifyToken, getUserInventory);

// 🟢 Friends routing
router.use('/friends', friendRoutes);

// 🟢 WebRTC routing
router.use('/webrtc', webrtcRoutes);

module.exports = router;
