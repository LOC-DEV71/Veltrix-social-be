const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên danh mục là bắt buộc!'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Slug danh mục là bắt buộc!'],
      unique: true,
      trim: true,
      lowercase: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    // parentId = null → là danh mục gốc (root)
    // parentId = ObjectId → là danh mục con của danh mục cha tương ứng
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index để tăng tốc truy vấn theo parentId
categorySchema.index({ parentId: 1 });

module.exports = mongoose.model('Category', categorySchema);
