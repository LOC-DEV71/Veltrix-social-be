const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Community name is required'],
      trim: true,
      minlength: [2, 'Community name must be at least 2 characters'],
      maxlength: [100, 'Community name cannot exceed 100 characters'],
    },
    icon: {
      type: String, // URL to the community icon
      default: null,
    },
    banner: {
      type: String, // URL to the community banner (requires boost)
      default: null,
    },
    isBoosted: {
      type: Boolean,
      default: false,
    },
    boost2: {
      type: Boolean,
      default: false,
    },
    serverTag: {
      type: String,
      maxlength: 4,
      default: null,
    },
    serverBadge: {
      type: String,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member'],
          default: 'member',
        },
        nickname: {
          type: String,
          default: null,
          maxlength: 50
        },
        avatar: {
          type: String,
          default: null
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        notificationSettings: {
          level: { type: String, enum: ['all', 'mentions', 'none'], default: 'all' },
          suppressEveryone: { type: Boolean, default: false },
          suppressRoles: { type: Boolean, default: false },
          suppressHighlights: { type: Boolean, default: false },
          muteEvents: { type: Boolean, default: false },
          mobilePush: { type: Boolean, default: true }
        }
      },
    ],
    emojis: [{
      name: String,
      url: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }],
    stickers: [{
      name: String,
      url: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }],
    // Optional: Invite codes, description, etc.
    description: {
      type: String,
      maxlength: 255,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Community', communitySchema);
