const express = require('express');
const router = express.Router();
const { register, login, getMe, logout, updateProfile, googleLogin, sendOTP, verifyOTP } = require('../../controllers/client/authController');
const { verifyToken } = require('../../middleware/authMiddleware');
const { upload } = require('../../config/cloudinary');

const profileUpload = upload.fields([
  { name: 'avatarFile', maxCount: 1 },
  { name: 'bannerFile', maxCount: 1 }
]);

// POST /api/auth/send-otp (Public)
router.post('/send-otp', sendOTP);

// POST /api/auth/verify-otp (Public)
router.post('/verify-otp', verifyOTP);

// POST /api/auth/register (Public)
router.post('/register', register);

// POST /api/auth/login (Public)
router.post('/login', login);

// POST /api/auth/google (Public)
router.post('/google', googleLogin);

// POST /api/auth/logout (Public)
router.post('/logout', logout);

// GET /api/auth/me (Private - requires verifyToken verification)
router.get('/me', verifyToken, getMe);

// PUT /api/auth/profile (Private)
router.put('/profile', verifyToken, profileUpload, updateProfile);

module.exports = router;
