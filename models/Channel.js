const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
      minlength: [1, 'Channel name must be at least 1 character'],
      maxlength: [100, 'Channel name cannot exceed 100 characters'],
      // Usually discord channels are lowercase and hyphenated, but we can enforce that on the frontend
    },
    type: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
    },
    order: {
      type: Number,
      default: 0, // To maintain the ordering of channels in the sidebar
    },
    topic: {
      type: String,
      maxlength: 1024,
      default: '',
    },
    nsfw: {
      type: Boolean,
      default: false,
    },
    slowMode: {
      type: Number,
      default: 0,
    },
    permissionOverwrites: {
      type: [
        {
          id: { type: String, required: true }, // 'everyone', role id, or user id
          type: { type: String, enum: ['role', 'member'], required: true },
          allow: [{ type: String }], // Array of permission strings
          deny: [{ type: String }], // Array of permission strings
        }
      ],
      default: []
    },
  },
  { timestamps: true }
);

// We might want an index on community to fetch channels quickly
channelSchema.index({ community: 1 });

module.exports = mongoose.model('Channel', channelSchema);
