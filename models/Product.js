const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    staticUrl: {
      type: String,
      required: [true, 'Static frame image URL is required'],
      trim: true,
    },
    animatedUrl: {
      type: String,
      required: [true, 'Animated frame GIF/image URL is required'],
      trim: true,
    },
    // Liên kết tới danh mục sản phẩm (tùy chọn — không bắt buộc để không phá vỡ data cũ)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Product', productSchema);
