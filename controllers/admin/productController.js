const User = require('../../models/User');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const { cloudinary } = require('../../config/cloudinary');

// @desc    Add new avatar frame product to the MongoDB shop
// @route   POST /api/admin/products
// @access  Private (Admin Only)
const addProduct = async (req, res) => {
  try {
    console.log('🔴 DEBUG req.body:', req.body);
    console.log('🔴 DEBUG req.files:', req.files);
    
    const { name, price, category } = req.body;

    // Lấy URL từ file đã upload qua Cloudinary
    const staticUrl = req.files?.staticImage ? req.files.staticImage[0].path : null;
    const animatedUrl = req.files?.animatedImage ? req.files.animatedImage[0].path : null;

    if (!name || price === undefined || !staticUrl || !animatedUrl) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: name, price và tải lên 2 ảnh (static, animated)'
      });
    }

    // Validate category nếu được cung cấp
    if (category) {
      const catExists = await Category.findById(category);
      if (!catExists) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục sản phẩm không tồn tại!'
        });
      }
    }

    const newProduct = await Product.create({
      name,
      price,
      staticUrl,
      animatedUrl,
      category: category || null
    });

    // Populate category để trả về thông tin đầy đủ
    await newProduct.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: `Tạo sản phẩm Khung '${name}' thành công!`,
      data: newProduct
    });
  } catch (error) {
    console.error(`🔴 Admin Create Product Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tạo sản phẩm mới trên database!'
    });
  }
};

// @desc    Get all products in shop with category populated
// @route   GET /api/admin/products/list
// @access  Private (Admin Only)
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '', sort = 'newest' } = req.query;
    
    // Build query
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sort === 'oldest') sortOptions = { createdAt: 1 };
    if (sort === 'price_asc') sortOptions = { price: 1 };
    if (sort === 'price_desc') sortOptions = { price: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .populate('category', 'name slug parentId')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalPages,
        totalProducts
      }
    });
  } catch (error) {
    console.error(`🔴 Admin Get Products Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách sản phẩm!'
    });
  }
};

// Hàm hỗ trợ để lấy public_id từ URL Cloudinary
const getCloudinaryPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  const publicId = lastPart.split('.')[0];
  const folder = parts[parts.length - 2];
  return `${folder}/${publicId}`;
};

// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private (Admin Only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category } = req.body;

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm!' });
    }

    const updateData = { name, price: Number(price) };
    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }

    if (category !== undefined) {
      if (category) {
        const catExists = await Category.findById(category);
        if (!catExists) return res.status(400).json({ success: false, message: 'Danh mục không tồn tại!' });
      }
      updateData.category = category || null;
    }

    // Nếu có file mới upload, xóa ảnh cũ trên Cloudinary và dùng ảnh mới
    if (req.files?.staticImage) {
      const oldPublicId = getCloudinaryPublicId(existingProduct.staticUrl);
      if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId);
      updateData.staticUrl = req.files.staticImage[0].path;
    }

    if (req.files?.animatedImage) {
      const oldPublicId = getCloudinaryPublicId(existingProduct.animatedUrl);
      if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId);
      updateData.animatedUrl = req.files.animatedImage[0].path;
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true })
      .populate('category', 'name slug');

    res.status(200).json({
      success: true,
      message: `Đã cập nhật sản phẩm "${name || existingProduct.name}" thành công!`,
      data: updatedProduct
    });
  } catch (error) {
    console.error(`🔴 Admin Update Product Controller Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật sản phẩm!' });
  }
};

// @desc    Delete a product
// @route   DELETE /api/admin/products/:id
// @access  Private (Admin Only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm cần xóa!' });
    }

    // Xóa ảnh trên Cloudinary
    const staticId = getCloudinaryPublicId(product.staticUrl);
    const animatedId = getCloudinaryPublicId(product.animatedUrl);
    if (staticId) await cloudinary.uploader.destroy(staticId);
    if (animatedId) await cloudinary.uploader.destroy(animatedId);

    // Xóa reference trong User.ownedFrames và activeFrame
    await User.updateMany({ ownedFrames: id }, { $pull: { ownedFrames: id } });
    await User.updateMany({ activeFrame: id }, { $set: { activeFrame: null } });

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Đã xóa sản phẩm "${product.name}" thành công!`
    });
  } catch (error) {
    console.error(`🔴 Admin Delete Product Controller Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa sản phẩm!' });
  }
};

// @desc    Perform bulk action on products
// @route   PUT /api/admin/products/bulk
// @access  Private (Admin Only)
const bulkActionProducts = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một sản phẩm!' });
    }

    if (action === 'activate') {
      await Product.updateMany({ _id: { $in: ids } }, { $set: { isActive: true } });
      res.status(200).json({ success: true, message: `Đã hiển thị ${ids.length} sản phẩm.` });
    } else if (action === 'deactivate') {
      await Product.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
      res.status(200).json({ success: true, message: `Đã ẩn ${ids.length} sản phẩm.` });
    } else if (action === 'delete') {
      // Find all products to delete images
      const products = await Product.find({ _id: { $in: ids } });
      for (const product of products) {
        const staticId = getCloudinaryPublicId(product.staticUrl);
        const animatedId = getCloudinaryPublicId(product.animatedUrl);
        if (staticId) await cloudinary.uploader.destroy(staticId);
        if (animatedId) await cloudinary.uploader.destroy(animatedId);
      }
      
      // Remove references
      await User.updateMany({ ownedFrames: { $in: ids } }, { $pullAll: { ownedFrames: ids } });
      await User.updateMany({ activeFrame: { $in: ids } }, { $set: { activeFrame: null } });
      
      await Product.deleteMany({ _id: { $in: ids } });
      res.status(200).json({ success: true, message: `Đã xóa ${ids.length} sản phẩm.` });
    } else {
      res.status(400).json({ success: false, message: 'Hành động không hợp lệ!' });
    }
  } catch (error) {
    console.error(`🔴 Admin Bulk Action Controller Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Lỗi khi thực hiện thao tác hàng loạt!' });
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  bulkActionProducts
};
