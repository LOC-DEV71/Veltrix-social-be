const express = require('express');
const router = express.Router();

// Import middlewares
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');

// Import individual route files
const adminAuthRoutes = require('./adminAuthRoutes');
const accountRoutes = require('./accountRoutes');
const roleRoutes = require('./roleRoutes');
const permissionRoutes = require('./permissionRoutes');
const categoryRoutes = require('./categoryRoutes');

// No legacy controllers needed anymore

// 🔴 Administrative Auth Routes (handles login, logout, me internally)
router.use('/auth', adminAuthRoutes);

// 🔒 Protected Administrative CRUD Routes
router.use('/accounts', accountRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', require('./productRoutes'));
router.use('/users', require('./userRoutes'));

module.exports = router;
