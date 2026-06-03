const Product = require('../../models/Product');
const Category = require('../../models/Category');
const User = require('../../models/User');
const Inventory = require('../../models/Inventory');
const PremiumProduct = require('../../models/PremiumProduct');
const jwt = require('jsonwebtoken');

// Helper to clean up expired premium items
const cleanupExpiredItems = async (user) => {
  if (!user) return user;
  
  const inventory = await Inventory.findOne({ user: user._id });
  if (!inventory) return user;

  const now = new Date();
  let hasExpiredItems = false;
  
  // Find expired items or items to revoke if user lost premium
  let expiredItems = [];
  if (!user.isPremium) {
    // If user is no longer premium, revoke all items that were collected as a premium perk
    expiredItems = inventory.items.filter(item => item.isPremiumPerk === true || (item.expiresAt != null && item.expiresAt < now));
  } else {
    // Normal check: remove items past their expiration date
    expiredItems = inventory.items.filter(item => item.expiresAt && item.expiresAt < now);
  }
  
  if (expiredItems.length > 0) {
    hasExpiredItems = true;
    
    // Remove from inventory
    if (!user.isPremium) {
      inventory.items = inventory.items.filter(item => item.isPremiumPerk !== true && (!item.expiresAt || item.expiresAt >= now));
    } else {
      inventory.items = inventory.items.filter(item => !item.expiresAt || item.expiresAt >= now);
    }
    await inventory.save();
    
    // Remove from User document
    expiredItems.forEach(item => {
      const prodIdStr = item.product.toString();
      
      // Remove from owned arrays safely using Mongoose pull
      if (user.ownedFrames) user.ownedFrames.pull(item.product);
      if (user.ownedNameplates) user.ownedNameplates.pull(item.product);
      if (user.ownedProfileEffects) user.ownedProfileEffects.pull(item.product);
      
      // Safely get active item IDs (handles both populated and unpopulated)
      const activeFrameId = user.activeFrame ? (user.activeFrame._id ? user.activeFrame._id.toString() : user.activeFrame.toString()) : null;
      const activeNameplateId = user.activeNameplate ? (user.activeNameplate._id ? user.activeNameplate._id.toString() : user.activeNameplate.toString()) : null;
      const activeProfileEffectId = user.activeProfileEffect ? (user.activeProfileEffect._id ? user.activeProfileEffect._id.toString() : user.activeProfileEffect.toString()) : null;
      
      // Unequip if active
      if (activeFrameId === prodIdStr) {
        user.activeFrame = null;
        user.activeFrameStaticUrl = "";
        user.activeFrameAnimatedUrl = "";
      }
      
      if (activeNameplateId === prodIdStr) {
        user.activeNameplate = null;
        user.activeNameplateStaticUrl = "";
        user.activeNameplateAnimatedUrl = "";
      }

      if (activeProfileEffectId === prodIdStr) {
        user.activeProfileEffect = null;
        user.activeProfileEffectStaticUrl = "";
        user.activeProfileEffectAnimatedUrl = "";
        user.activeProfileEffectLayers = [];
      }
    });
    
    await user.save();
  }
  
  return user;
};

// @desc    Get all avatar frames
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({})
      .populate('category')
      .populate({
        path: 'comboItems',
        populate: { path: 'category' }
      })
      .sort({ price: 1 });
    res.status(200).json({
      status: 'success',
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error(`🔴 Get Products Controller Error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ khi lấy danh sách sản phẩm!'
    });
  }
};

// @desc    Get active premium perks
// @route   GET /api/shop/premium
// @access  Public
const getPremiumPerks = async (req, res) => {
  try {
    const now = new Date();
    // Only return premium perks that are currently active
    const premiumItems = await PremiumProduct.find({
      startDate: { $lte: now },
      endDate: { $gt: now }
    }).populate({
      path: 'product',
      populate: [
        { path: 'category' },
        { 
          path: 'comboItems',
          populate: { path: 'category' }
        }
      ]
    });

    // Map to a cleaner format where the top level IS the product, but marked as premium
    const mapped = premiumItems.map(p => {
      const prod = p.product.toObject();
      prod.isPremium = true;
      prod.premiumStartDate = p.startDate;
      prod.premiumEndDate = p.endDate;
      return prod;
    });

    res.status(200).json({
      status: 'success',
      data: mapped
    });
  } catch (error) {
    console.error(`🔴 Get Premium Perks Error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi khi lấy danh sách phần thưởng Premium!'
    });
  }
};

// @desc    Claim a premium perk
// @route   POST /api/shop/claim-premium
// @access  Private
const claimPremiumProduct = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Thiếu thông tin nhận quà!'
      });
    }

    // 1. Fetch User and check Premium
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy user!' });
    }

    if (!user.isPremium) {
      return res.status(403).json({
        status: 'error',
        message: 'Bạn phải là hội viên Premium mới nhận được phần thưởng này!'
      });
    }

    // 2. Check if product is currently active in PremiumProduct
    const now = new Date();
    const premiumConfig = await PremiumProduct.findOne({
      product: productId,
      startDate: { $lte: now },
      endDate: { $gt: now }
    }).populate('product');

    if (!premiumConfig || !premiumConfig.product) {
      return res.status(404).json({
        status: 'error',
        message: 'Sản phẩm này không còn nằm trong danh sách quà tặng Premium!'
      });
    }

    const product = premiumConfig.product;

    let inventory = await Inventory.findOne({ user: userId });
    if (!inventory) {
      inventory = new Inventory({ user: userId, items: [] });
    }

    // Lấy danh sách item cần xử lý (hỗ trợ combo)
    let itemsToProcess = [];
    if (product.isCombo) {
      if (!product.comboItems || product.comboItems.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Combo rỗng!' });
      }
      // Populate combo items to process
      const populatedProduct = await Product.findById(product._id).populate({
        path: 'comboItems',
        populate: { path: 'category' }
      });
      itemsToProcess = populatedProduct.comboItems;
    } else {
      // populate category
      const populatedProduct = await Product.findById(product._id).populate('category');
      itemsToProcess = [populatedProduct];
    }

    let newItemsCount = 0;

    for (const item of itemsToProcess) {
      const categorySlug = item.category ? item.category.slug : 'unknown';
      const isFrame = categorySlug === 'khung-vien';
      const isNameplate = categorySlug === 'bang-ten';
      const isProfileEffect = categorySlug === 'hieu-ung-ho-so';

      // Kiểm tra xem đã nhận hoặc mua chưa
      let alreadyOwned = false;
      if (isFrame && user.ownedFrames.includes(item._id.toString())) alreadyOwned = true;
      if (isNameplate && user.ownedNameplates.includes(item._id.toString())) alreadyOwned = true;
      if (isProfileEffect && user.ownedProfileEffects.includes(item._id.toString())) alreadyOwned = true;

      // Nếu đã sở hữu vĩnh viễn (không phải premium perk, không có expiresAt) thì skip
      // Nếu đã sở hữu nhưng là premium perk thì vẫn skip vì đang xử lý premium
      if (alreadyOwned) continue;

      if (isFrame) {
        user.ownedFrames.push(item._id);
        user.activeFrame = item._id;
        user.activeFrameStaticUrl = item.staticUrl || null;
        user.activeFrameAnimatedUrl = item.animatedUrl || null;
      } else if (isNameplate) {
        user.ownedNameplates.push(item._id);
        user.activeNameplate = item._id;
        user.activeNameplateStaticUrl = item.staticUrl || null;
        user.activeNameplateAnimatedUrl = item.animatedUrl || null;
      } else if (isProfileEffect) {
        user.ownedProfileEffects.push(item._id);
        user.activeProfileEffect = item._id;
        user.activeProfileEffectStaticUrl = item.staticUrl || null;
        user.activeProfileEffectAnimatedUrl = item.animatedUrl || null;
        user.activeProfileEffectLayers = item.effectLayers || [];
      }

      inventory.items.push({
        product: item._id,
        category: item.category ? item.category._id : null,
        categorySlug: categorySlug,
        purchasedAt: new Date(),
        isPremiumPerk: true,
        expiresAt: premiumConfig.endDate
      });

      newItemsCount++;
    }

    if (newItemsCount === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Bạn đã sở hữu phần thưởng này rồi!'
      });
    }

    await inventory.save();
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Nhận quà Premium thành công! Đã tự động trang bị.'
    });

  } catch (error) {
    console.error(`🔴 Claim Premium Error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi khi nhận quà!'
    });
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.status(200).json({
      status: 'success',
      data: categories
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Lỗi lấy danh mục' });
  }
};

// @desc    Get current user profile (Seeded Dev User)
// @route   GET /api/users/profile
// @access  Public
const getUserProfile = async (req, res) => {
  try {
    let userId;

    // Check if authorization header token is present
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        userId = decoded.id || decoded._id;
      } catch (err) {
        // Silent catch: token expired or invalid, will fallback to Minh Khang dev user
      }
    }

    let user;
    if (userId) {
      user = await User.findById(userId)
        .populate('ownedFrames')
        .populate('activeFrame');
    }

    if (!user) {
      user = await User.findOne({ username: 'Minh Khang' })
        .populate('ownedFrames')
        .populate('activeFrame');
    }
    
    if (!user) {
      user = await User.findOne({})
        .populate('ownedFrames')
        .populate('activeFrame');
    }

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy tài khoản test. Hãy khởi động lại server để seeder chạy!'
      });
    }

    // Run cleanup
    user = await cleanupExpiredItems(user);

    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (error) {
    console.error(`🔴 Get User Profile Controller Error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ khi lấy thông tin người dùng!'
    });
  }
};

// @desc    Get user inventory
// @route   GET /api/users/inventory
// @access  Protected
const getUserInventory = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    // Run cleanup before returning
    const user = await User.findById(userId);
    if (user) {
      await cleanupExpiredItems(user);
    }

    const inventory = await Inventory.findOne({ user: userId })
      .populate('items.product')
      .populate('items.category');

    res.status(200).json({
      status: 'success',
      data: inventory ? inventory.items : []
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Lỗi hệ thống' });
  }
};

// @desc    Dev Quick Login to sign a cryptographically valid JWT Token
// @route   POST /api/users/login
// @access  Public (Development testing helper)
const loginDev = async (req, res) => {
  try {
    const user = await User.findOne({ username: 'Minh Khang' });
    if (!user) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Không tìm thấy tài khoản Minh Khang. Vui lòng restart backend để seed user!' 
      });
    }

    // Sign a standard JWT token valid for 30 days
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '30d' }
    );

    res.status(200).json({
      status: 'success',
      token,
      data: user
    });
  } catch (error) {
    console.error(`🔴 Login Dev Controller Error: ${error.message}`);
    res.status(500).json({ 
      status: 'error', 
      message: 'Lỗi máy chủ khi tạo mã JWT Token xác thực!' 
    });
  }
};

// @desc    Buy an avatar frame
// @route   POST /api/shop/buy
// @access  Public (Protected by Anti-Spam rate-limiter)
const buyProduct = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng cung cấp đầy đủ thông tin: userId và productId'
      });
    }

    // 1. Fetch Product
    const product = await Product.findById(productId)
      .populate('category')
      .populate({
        path: 'comboItems',
        populate: { path: 'category' }
      });

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Sản phẩm không tồn tại trên hệ thống!'
      });
    }

    // 2. Fetch User
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy người dùng này!'
      });
    }

    let inventory = await Inventory.findOne({ user: userId });
    if (!inventory) {
      inventory = new Inventory({ user: userId, items: [] });
    }

    // Lấy danh sách các item cần process
    let itemsToProcess = [];
    if (product.isCombo) {
      if (!product.comboItems || product.comboItems.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Gói combo này đang trống!' });
      }
      itemsToProcess = product.comboItems;
    } else {
      itemsToProcess = [product];
    }

    let newItemsCount = 0;
    let ownedItemsCount = 0;
    let effectivePrice = product.price;

    // === TÍNH GIÁ ===
    if (product.isCombo) {
      // Combo: trừ giá các item đã sở hữu
      let discount = 0;
      for (const item of itemsToProcess) {
        const categorySlug = item.category ? item.category.slug : 'unknown';
        const isFrame = categorySlug === 'khung-vien';
        const isNameplate = categorySlug === 'bang-ten';
        const isProfileEffect = categorySlug === 'hieu-ung-ho-so';

        let alreadyOwned = false;
        if (isFrame && user.ownedFrames.includes(item._id.toString())) alreadyOwned = true;
        if (isNameplate && user.ownedNameplates.includes(item._id.toString())) alreadyOwned = true;
        if (isProfileEffect && user.ownedProfileEffects.includes(item._id.toString())) alreadyOwned = true;

        if (alreadyOwned) {
          discount += item.price || 0;
        }
      }
      effectivePrice -= discount;
      if (effectivePrice < 0) effectivePrice = 0;
    }

    // Check coin
    if (user.coins < effectivePrice) {
      return res.status(400).json({
        status: 'error',
        message: `Bạn không đủ Coin để thực hiện giao dịch! Cần thêm ${effectivePrice - user.coins} Coin.`
      });
    }

    // === XỬ LÝ TỪNG ITEM ===
    for (const item of itemsToProcess) {
      const categorySlug = item.category ? item.category.slug : 'unknown';
      const isFrame = categorySlug === 'khung-vien';
      const isNameplate = categorySlug === 'bang-ten';
      const isProfileEffect = categorySlug === 'hieu-ung-ho-so';

      let alreadyOwned = false;
      if (isFrame && user.ownedFrames.includes(item._id.toString())) alreadyOwned = true;
      if (isNameplate && user.ownedNameplates.includes(item._id.toString())) alreadyOwned = true;
      if (isProfileEffect && user.ownedProfileEffects.includes(item._id.toString())) alreadyOwned = true;

      // Ghi đè thành vĩnh viễn
      let isUpgradeToPermanent = false;
      if (alreadyOwned) {
        const existingItem = inventory.items.find(i => i.product.toString() === item._id.toString());
        if (existingItem && (existingItem.expiresAt || existingItem.isPremiumPerk)) {
          isUpgradeToPermanent = true;
          alreadyOwned = false; // Xử lý như mới để cập nhật
          
          // Xóa item cũ trong inventory để lát push cái mới
          inventory.items = inventory.items.filter(i => i.product.toString() !== item._id.toString());
        }
      }

      if (!alreadyOwned) {
        if (!isUpgradeToPermanent) {
          if (isFrame) {
            user.ownedFrames.push(item._id);
            user.activeFrame = item._id;
            user.activeFrameStaticUrl = item.staticUrl || null;
            user.activeFrameAnimatedUrl = item.animatedUrl || null;
          } else if (isNameplate) {
            user.ownedNameplates.push(item._id);
            user.activeNameplate = item._id;
            user.activeNameplateStaticUrl = item.staticUrl || null;
            user.activeNameplateAnimatedUrl = item.animatedUrl || null;
          } else if (isProfileEffect) {
            user.ownedProfileEffects.push(item._id);
            user.activeProfileEffect = item._id;
            user.activeProfileEffectStaticUrl = item.staticUrl || null;
            user.activeProfileEffectAnimatedUrl = item.animatedUrl || null;
            user.activeProfileEffectLayers = item.effectLayers || [];
          }
        }

        inventory.items.push({
          product: item._id,
          category: item.category ? item.category._id : null,
          categorySlug: item.category ? item.category.slug : null,
          purchasedAt: new Date()
        });

        newItemsCount++;
      } else {
        ownedItemsCount++;
      }
    }

    if (!product.isCombo && newItemsCount === 0) {
      return res.status(400).json({ status: 'error', message: 'Bạn đã sở hữu sản phẩm này rồi!' });
    }

    if (product.isCombo && newItemsCount === 0) {
       return res.status(400).json({ status: 'error', message: 'Bạn đã sở hữu tất cả sản phẩm trong gói combo này rồi!' });
    }

    // Trừ coin
    user.coins -= effectivePrice;

    await user.save();
    await inventory.save();

    // Populate user profile for updated return
    const updatedUser = await User.findById(userId)
      .populate('ownedFrames')
      .populate('activeFrame')
      .populate('ownedNameplates')
      .populate('activeNameplate')
      .populate('ownedProfileEffects')
      .populate('activeProfileEffect');

    res.status(200).json({
      status: 'success',
      message: `Chúc mừng! Bạn đã sở hữu thành công ${product.name}!`,
      data: updatedUser
    });

  } catch (error) {
    console.error(`🔴 Buy Product Controller Error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi hệ thống khi xử lý mua hàng!'
    });
  }
};

module.exports = {
  getProducts,
  getCategories,
  getUserProfile,
  getUserInventory,
  loginDev,
  buyProduct,
  getPremiumPerks,
  claimPremiumProduct
};
