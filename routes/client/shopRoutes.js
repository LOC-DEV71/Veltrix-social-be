const express = require('express');
const router = express.Router();
const { getProducts, getCategories, buyProduct, getPremiumPerks, claimPremiumProduct } = require('../../controllers/client/shopController');
const antiSpam = require('../../middleware/antiSpam');

// GET /api/categories
router.get('/categories', getCategories);

// GET /api/products
router.get('/products', getProducts);

// GET /api/shop/premium
router.get('/premium', getPremiumPerks);

// POST /api/shop/claim-premium
router.post('/claim-premium', antiSpam, claimPremiumProduct);

// POST /api/shop/buy -> we will handle POST /buy inside the shop master sub-router
router.post('/buy', antiSpam, buyProduct);

module.exports = router;
