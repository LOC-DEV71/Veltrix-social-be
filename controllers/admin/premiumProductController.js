const PremiumProduct = require('../../models/PremiumProduct');
const Product = require('../../models/Product');

// @desc    Setup premium products
// @route   POST /api/admin/premium-products
// @access  Private (Admin Only)
const setupPremiumProducts = async (req, res) => {
  try {
    const { products, startDate, endDate } = req.body;

    if (!products || !products.length || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn sản phẩm và thời gian!' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc!' });
    }

    // Process each product ID
    for (const productId of products) {
      const productExists = await Product.findById(productId);
      if (!productExists) continue;

      // Upsert: Find if this product already has a premium configuration, update if exists, otherwise create
      await PremiumProduct.findOneAndUpdate(
        { product: productId },
        { startDate: start, endDate: end },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({ success: true, message: `Đã lưu thiết lập Premium cho ${products.length} sản phẩm thành công!` });
  } catch (error) {
    console.error(`🔴 Premium Setup Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thiết lập Premium!' });
  }
};

// @desc    Get all premium products
// @route   GET /api/admin/premium-products
// @access  Private
const getPremiumProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sort = 'newest' } = req.query;

    let query = {};
    if (search) {
      // Find products matching the search
      const products = await Product.find({ name: { $regex: search, $options: 'i' } });
      const productIds = products.map(p => p._id);
      query = { product: { $in: productIds } };
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'oldest') sortOptions = { createdAt: 1 };

    const skip = (Number(page) - 1) * Number(limit);

    const list = await PremiumProduct.find(query)
      .populate('product', 'name price staticUrl animatedUrl')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const totalItems = await PremiumProduct.countDocuments(query);
    const totalPages = Math.ceil(totalItems / Number(limit));

    res.status(200).json({ 
      success: true, 
      data: list,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalPages,
        totalItems
      }
    });
  } catch (error) {
    console.error(`🔴 Get Premium Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách Premium!' });
  }
};

// @desc    Delete a premium product
// @route   DELETE /api/admin/premium-products/:id
// @access  Private
const deletePremiumProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await PremiumProduct.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Đã gỡ sản phẩm khỏi danh sách Premium!' });
  } catch (error) {
    console.error(`🔴 Delete Premium Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa Premium!' });
  }
};

// @desc    Bulk action for premium products
// @route   PUT /api/admin/premium-products/bulk
// @access  Private (Admin Only)
const bulkActionPremium = async (req, res) => {
  try {
    const { ids, action } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một sản phẩm!' });
    }

    if (action === 'delete') {
      await PremiumProduct.deleteMany({ _id: { $in: ids } });
      res.status(200).json({ success: true, message: `Đã xóa ${ids.length} sản phẩm khỏi Premium.` });
    } else {
      res.status(400).json({ success: false, message: 'Hành động không hợp lệ!' });
    }
  } catch (error) {
    console.error(`🔴 Bulk Premium Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi khi thực hiện thao tác hàng loạt!' });
  }
};

module.exports = {
  setupPremiumProducts,
  getPremiumProducts,
  deletePremiumProduct,
  bulkActionPremium
};
