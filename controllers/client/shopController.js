const Product = require('../../models/Product');
const Category = require('../../models/Category');
const User = require('../../models/User');
const Inventory = require('../../models/Inventory');
const jwt = require('jsonwebtoken');

// @desc    Get all avatar frames
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate('category').sort({ price: 1 });
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
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Sản phẩm (Khung) không tồn tại trên hệ thống!'
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

    // 3. Check if already purchased based on category
    const categorySlug = product.category ? product.category.slug : 'unknown';
    const isFrame = categorySlug === 'khung-vien';
    const isNameplate = categorySlug === 'bang-ten';

    if (isFrame && user.ownedFrames.includes(productId)) {
      return res.status(400).json({ status: 'error', message: 'Bạn đã sở hữu khung avatar này rồi!' });
    }
    if (isNameplate && user.ownedNameplates.includes(productId)) {
      return res.status(400).json({ status: 'error', message: 'Bạn đã sở hữu bảng tên này rồi!' });
    }

    // 4. Check if coins sufficient
    if (user.coins < product.price) {
      return res.status(400).json({
        status: 'error',
        message: `Bạn không đủ Coin để thực hiện giao dịch! Cần thêm ${product.price - user.coins} Coin.`
      });
    }

    // 5. Deduct coins and auto-equip
    user.coins -= product.price;
    
    if (isFrame) {
      user.ownedFrames.push(productId);
      user.activeFrame = productId;
      user.activeFrameStaticUrl = product.staticUrl || null;
      user.activeFrameAnimatedUrl = product.animatedUrl || null;
    } else if (isNameplate) {
      user.ownedNameplates.push(productId);
      user.activeNameplate = productId;
      user.activeNameplateStaticUrl = product.staticUrl || null;
      user.activeNameplateAnimatedUrl = product.animatedUrl || null;
    }

    await user.save();

    // 6. Update separate Inventory Table
    let inventory = await Inventory.findOne({ user: userId });
    if (!inventory) {
      inventory = new Inventory({ user: userId, items: [] });
    }
    
    inventory.items.push({
      product: productId,
      category: product.category ? product.category._id : null,
      categorySlug: product.category ? product.category.slug : null,
      purchasedAt: new Date()
    });
    await inventory.save();

    // Populate user profile for updated return
    const updatedUser = await User.findById(userId)
      .populate('ownedFrames')
      .populate('activeFrame')
      .populate('ownedNameplates')
      .populate('activeNameplate');

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
  buyProduct
};
