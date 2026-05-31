const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: function() {
        // Content is required UNLESS there are attachments
        return !this.attachments || this.attachments.length === 0;
      },
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true, // Keeping track of community makes global moderation easier
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    attachments: [
      {
        url: String,
        fileType: String, // 'image', 'video', 'file'
        name: String,
      }
    ],
    // For replies or mentions
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
      }
    ],
  },
  { timestamps: true }
);

// Index on channel for fast retrieval of message history
messageSchema.index({ channel: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
