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
      required: function() { return !this.isCombo; },
      trim: true,
    },
    animatedUrl: {
      type: String,
      required: function() { return !this.isCombo; },
      trim: true,
    },
    // Liên kết tới danh mục sản phẩm (tùy chọn — không bắt buộc để không phá vỡ data cũ)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isCombo: {
      type: Boolean,
      default: false
    },
    comboItems: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    // Extra animated layers for profile effects (multiple GIFs stacked)
    effectLayers: [{
      type: String,
      trim: true
    }]
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Product', productSchema);
