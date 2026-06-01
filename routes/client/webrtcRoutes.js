const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/authMiddleware');

router.get('/ice-servers', verifyToken, async (req, res) => {
  try {
    const domain = process.env.METERED_DOMAIN;
    const secretKey = process.env.METERED_SECRET_KEY;

    if (!domain || !secretKey) {
      console.warn('Metered domain or secret key missing in .env');
      return res.status(200).json([]);
    }

    const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${secretKey}`);
    
    if (!response.ok) {
      throw new Error(`Metered API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching ICE servers:', error);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin máy chủ trung chuyển' });
  }
});

module.exports = router;
