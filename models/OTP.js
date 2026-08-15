const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      trim: true,
      lowercase: true,
    },
    code: {
      type: String,
      required: [true, 'Mã OTP là bắt buộc'],
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // MongoDB TTL index: auto-deletes 300 seconds after creation
    },
  },
  {
    timestamps: true,
  }
);

// Index on email for fast lookups
otpSchema.index({ email: 1 });

module.exports = mongoose.model('OTP', otpSchema);
