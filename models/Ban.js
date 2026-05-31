const mongoose = require('mongoose');

const banSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    banType: {
      type: String,
      enum: ['email', 'ip', 'both'],
      default: 'both',
    },
    reason: {
      type: String,
      default: 'Vi phạm chính sách cộng đồng',
    },
    bannedBy: {
      type: String,
      default: 'System',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ban', banSchema);
