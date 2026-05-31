const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categorySlug: { type: String },
  purchasedAt: { type: Date, default: Date.now }
});

const inventorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [inventoryItemSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Inventory', inventorySchema);
