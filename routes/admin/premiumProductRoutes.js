const express = require('express');
const router = express.Router();
const { setupPremiumProducts, getPremiumProducts, deletePremiumProduct, bulkActionPremium } = require('../../controllers/admin/premiumProductController');
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');

// Apply admin protection to all routes
router.use(verifyToken, isAdmin);

// Setup Premium Products
router.get('/', getPremiumProducts);
router.post('/', setupPremiumProducts);
router.delete('/:id', deletePremiumProduct);
router.put('/bulk', bulkActionPremium);

module.exports = router;
