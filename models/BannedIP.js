const mongoose = require('mongoose');

const bannedIPSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    reason: {
      type: String,
      default: 'Hệ thống tự động phát hiện Spam request (Quá 10 reqs/3s)',
    },
    bannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BannedIP', bannedIPSchema);
