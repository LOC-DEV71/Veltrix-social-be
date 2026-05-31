const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    lastUsernameUpdate: {
      type: Date,
      default: null,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please fill a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    coins: {
      type: Number,
      default: 0,
      min: [0, 'Coins cannot be negative'],
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    lastIp: {
      type: String,
      default: null,
    },

    // Profile Settings
    displayName: {
      type: String,
      trim: true,
      default: null,
    },
    pronouns: {
      type: String,
      trim: true,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    bannerColor: {
      type: String,
      default: '#85744a',
    },
    bannerImage: {
      type: String,
      default: null,
    },
    themeColors: {
      primary: { type: String, default: null },
      accent: { type: String, default: null },
    },
    customStatus: {
      text: { type: String, default: null },
      emoji: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null }
    },

    // Inventory & Customization
    ownedFrames: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    activeFrame: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    activeFrameStaticUrl: { type: String, default: null },
    activeFrameAnimatedUrl: { type: String, default: null },
    ownedNameplates: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    activeNameplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    activeNameplateStaticUrl: { type: String, default: null },
    activeNameplateAnimatedUrl: { type: String, default: null },
    ownedProfileEffects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    activeProfileEffect: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },

    // Friends System
    friends: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    friendRequests: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      type: { type: String, enum: ['incoming', 'outgoing'] },
      status: { type: String, enum: ['pending'] },
      createdAt: { type: Date, default: Date.now }
    }],
    blockedUsers: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    communityInvites: [{
      community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
