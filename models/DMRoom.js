const mongoose = require('mongoose');

const dmRoomSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct'
    },
    groupName: {
      type: String,
      default: null
    },
    groupIcon: {
      type: String,
      default: null
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DirectMessage',
      default: null
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index on participants for fast lookup
dmRoomSchema.index({ participants: 1 });

module.exports = mongoose.model('DMRoom', dmRoomSchema);
