const express = require('express');
const router = express.Router();
const { getProducts, getCategories, buyProduct } = require('../../controllers/client/shopController');
const antiSpam = require('../../middleware/antiSpam');

// GET /api/categories
router.get('/categories', getCategories);

// GET /api/products
router.get('/products', getProducts);

// POST /api/shop/buy -> we will handle POST /buy inside the shop master sub-router
router.post('/buy', antiSpam, buyProduct);

module.exports = router;
