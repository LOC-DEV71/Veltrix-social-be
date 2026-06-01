const mongoose = require('mongoose');

const premiumProductSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PremiumProduct', premiumProductSchema);
