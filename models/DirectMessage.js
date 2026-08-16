const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema(
  {
    dmRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DMRoom',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: function() {
        return !this.attachments || this.attachments.length === 0;
      },
      trim: true,
      maxlength: [2000, 'Direct message cannot exceed 2000 characters']
    },
    attachments: [
      {
        url: String,
        fileType: String,
        name: String
      }
    ],
    isSticker: {
      type: Boolean,
      default: false,
    },
    linkMetadata: {
      title: String,
      description: String,
      image: String,
      url: String,
      siteName: String,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DirectMessage',
      default: null
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
      }
    ],
    isEdited: {
      type: Boolean,
      default: false
    },
    isPinned: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Index on dmRoom and createdAt for fast history queries
directMessageSchema.index({ dmRoom: 1, createdAt: -1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);
