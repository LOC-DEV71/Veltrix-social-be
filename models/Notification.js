const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: ['friend_request', 'friend_accept', 'community_invite', 'community_join', 'system', 'mention', 'channel_message'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // Optional community reference if the notification is related to a community
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
