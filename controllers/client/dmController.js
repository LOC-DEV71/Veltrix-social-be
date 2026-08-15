const DMRoom = require('../../models/DMRoom');
const DirectMessage = require('../../models/DirectMessage');
const User = require('../../models/User');
const Community = require('../../models/Community');

// @desc    Get or create 1-on-1 DM room with a target user
// @route   POST /api/dm/get-or-create
// @access  Private
const getOrCreateDMRoom = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId is required' });
    }

    if (String(targetUserId) === String(currentUserId)) {
      return res.status(400).json({ success: false, message: 'Cannot create DM room with yourself' });
    }

    // Find recipient user profile
    const targetUser = await User.findById(targetUserId)
      .select('-password -email')
      .populate('activeFrame')
      .populate('activeNameplate')
      .populate('activeProfileEffect');

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    // Calculate mutual communities shared between currentUserId and targetUserId
    const mutualCommunities = await Community.find({
      'members.user': { $all: [currentUserId, targetUserId] }
    }).select('_id name icon banner');

    // Check if 1-on-1 DM room already exists between currentUserId and targetUserId
    let room = await DMRoom.findOne({
      type: 'direct',
      participants: { $all: [currentUserId, targetUserId] }
    })
      .populate({
        path: 'participants',
        select: '-password -email',
        populate: [
          { path: 'activeFrame' },
          { path: 'activeNameplate' },
          { path: 'activeProfileEffect' }
        ]
      })
      .populate('lastMessage');

    if (!room) {
      room = await DMRoom.create({
        type: 'direct',
        participants: [currentUserId, targetUserId]
      });

      room = await DMRoom.findById(room._id)
        .populate({
          path: 'participants',
          select: '-password -email',
          populate: [
            { path: 'activeFrame' },
            { path: 'activeNameplate' },
            { path: 'activeProfileEffect' }
          ]
        });
    }

    res.status(200).json({
      success: true,
      data: {
        room,
        recipient: targetUser,
        mutualCommunities: mutualCommunities || []
      }
    });
  } catch (error) {
    console.error('🔴 Error in getOrCreateDMRoom:', error);
    res.status(500).json({ success: false, message: 'Server error creating DM room' });
  }
};

// @desc    Get all DM rooms for current user
// @route   GET /api/dm/rooms
// @access  Private
const getUserDMRooms = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const rooms = await DMRoom.find({ participants: currentUserId })
      .sort({ lastActivity: -1 })
      .populate({
        path: 'participants',
        select: '-password -email',
        populate: [{ path: 'activeFrame' }, { path: 'activeNameplate' }]
      })
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username displayName' }
      });

    // Deduplicate rooms by partner user ID
    const seenPartnerIds = new Set();
    const uniqueRooms = [];
    for (const room of rooms) {
      const partner = (room.participants || []).find(p => p && String(p._id || p.id) !== String(currentUserId));
      if (partner) {
        const partnerId = String(partner._id || partner.id);
        if (!seenPartnerIds.has(partnerId)) {
          seenPartnerIds.add(partnerId);
          uniqueRooms.push(room);
        }
      }
    }

    res.status(200).json({
      success: true,
      data: uniqueRooms
    });
  } catch (error) {
    console.error('🔴 Error in getUserDMRooms:', error);
    res.status(500).json({ success: false, message: 'Server error fetching DM rooms' });
  }
};

// @desc    Get message history for a DM room
// @route   GET /api/dm/messages/:roomId
// @access  Private
const getDMMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const room = await DMRoom.findById(roomId);
    if (!room || !room.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied to this DM room' });
    }

    const messages = await DirectMessage.find({ dmRoom: roomId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate({
        path: 'sender',
        select: 'username displayName avatar role activeFrame activeFrameStaticUrl activeFrameAnimatedUrl activeNameplate activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffect activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl',
        populate: [{ path: 'activeFrame' }, { path: 'activeNameplate' }, { path: 'activeProfileEffect' }]
      })
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username displayName' }
      });

    res.status(200).json({
      status: 'success',
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('🔴 Error in getDMMessages:', error);
    res.status(500).json({ success: false, message: 'Server error fetching DM messages' });
  }
};

// @desc    Send a new Direct Message
// @route   POST /api/dm/messages/:roomId
// @access  Private
const sendDirectMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, attachments, replyToId } = req.body;

    const room = await DMRoom.findById(roomId);
    if (!room || !room.participants.map(String).includes(String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Access denied to this DM room' });
    }

    const newMsg = await DirectMessage.create({
      dmRoom: roomId,
      sender: req.user._id,
      content,
      attachments: attachments || [],
      replyTo: replyToId || null
    });

    // Update room lastMessage and lastActivity
    room.lastMessage = newMsg._id;
    room.lastActivity = new Date();
    await room.save();

    const populatedMsg = await DirectMessage.findById(newMsg._id)
      .populate({
        path: 'sender',
        select: 'username displayName avatar role activeFrame activeFrameStaticUrl activeFrameAnimatedUrl activeNameplate activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffect activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl',
        populate: [{ path: 'activeFrame' }, { path: 'activeNameplate' }, { path: 'activeProfileEffect' }]
      })
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username displayName' }
      });

    res.status(201).json({
      success: true,
      data: populatedMsg
    });
  } catch (error) {
    console.error('🔴 Error in sendDirectMessage:', error);
    res.status(500).json({ success: false, message: 'Server error sending direct message' });
  }
};

// @desc    Toggle emoji reaction on a direct message
// @route   POST /api/dm/messages/:roomId/:msgId/reactions
// @access  Private
const toggleReaction = async (req, res) => {
  try {
    const { msgId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await DirectMessage.findById(msgId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    let reactionObj = message.reactions.find(r => r.emoji === emoji);

    if (reactionObj) {
      const userIndex = reactionObj.users.findIndex(u => String(u) === String(userId));
      if (userIndex > -1) {
        reactionObj.users.splice(userIndex, 1);
        if (reactionObj.users.length === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        reactionObj.users.push(userId);
      }
    } else {
      message.reactions.push({ emoji, users: [userId] });
    }

    await message.save();

    const updated = await DirectMessage.findById(msgId)
      .populate({
        path: 'sender',
        select: 'username displayName avatar role activeFrame activeFrameStaticUrl activeFrameAnimatedUrl activeNameplate activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffect activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl',
        populate: [{ path: 'activeFrame' }, { path: 'activeNameplate' }, { path: 'activeProfileEffect' }]
      })
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username displayName' }
      });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('🔴 Error in toggleReaction:', error);
    res.status(500).json({ success: false, message: 'Server error toggling reaction' });
  }
};

module.exports = {
  getOrCreateDMRoom,
  getUserDMRooms,
  getDMMessages,
  sendDirectMessage,
  toggleReaction
};
