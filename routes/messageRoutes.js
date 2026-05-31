const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Community = require('../models/Community');
const Notification = require('../models/Notification');
const Channel = require('../models/Channel');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../utils/permissionUtils');
const { upload } = require('../config/cloudinary');
const { getIO } = require('../socket');

// @desc    Get messages by channel ObjectId
// @route   GET /api/messages/:channelId
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Auth and permission check
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {}
    }

    if (userId) {
      const channel = await Channel.findById(channelId);
      if (channel) {
        const community = await Community.findById(channel.community);
        if (community) {
          const member = community.members.find(m => m.user.toString() === userId);
          if (member) {
            if (!checkPermission(channel, userId, member.role, 'view_channel')) {
              return res.status(403).json({ success: false, message: 'Bạn không có quyền xem kênh này' });
            }
            if (!checkPermission(channel, userId, member.role, 'read_message_history')) {
              // User can only see new messages via socket, not past messages
              return res.status(200).json({ success: true, count: 0, data: [] });
            }
          }
        }
      }
    }

    const { pinned, before, limit = 30 } = req.query;

    let query = { channel: channelId };
    if (pinned === 'true') {
      query.isPinned = true;
    } else if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Find messages for the channel
    let dbQuery = Message.find(query)
      .populate({
        path: 'sender',
        select: 'username displayName avatar coins isPremium bannerColor bannerImage activeFrame activeFrameStaticUrl activeFrameAnimatedUrl customStatus activeNameplate activeNameplateStaticUrl activeNameplateAnimatedUrl',
        populate: {
          path: 'activeFrame',
          model: 'Product'
        }
      })
      .populate({
        path: 'reactions.users',
        select: 'username displayName avatar bannerColor bannerImage'
      })
      .populate({
        path: 'replyTo',
        select: 'content sender attachments',
        populate: {
          path: 'sender',
          select: 'username displayName avatar'
        }
      });

    if (pinned !== 'true') {
      dbQuery = dbQuery.sort({ createdAt: -1 }).limit(Number(limit));
    } else {
      dbQuery = dbQuery.sort({ createdAt: 1 });
    }

    let messages = await dbQuery;

    if (pinned !== 'true') {
      messages = messages.reverse();
    }

    res.status(200).json({
      status: 'success',
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error(`🔴 Get Messages Error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ khi tải lịch sử tin nhắn!'
    });
  }
});

// @desc    Send a message with optional attachments
// @route   POST /api/messages/:channelId
router.post('/:channelId', verifyToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content, communityId, replyTo, forwardedAttachments } = req.body;
    const senderId = req.user.id;

    if (!communityId) {
      return res.status(400).json({ success: false, message: 'communityId is required' });
    }

    let parsedForwardedAttachments = [];
    if (forwardedAttachments) {
      try {
        parsedForwardedAttachments = JSON.parse(forwardedAttachments);
      } catch (err) {
        // ignore
      }
    }

    if (!content?.trim() && (!req.files || req.files.length === 0) && parsedForwardedAttachments.length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found' });
    }
    const member = community.members.find(m => m.user.toString() === senderId);
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }
    
    if (!checkPermission(channel, senderId, member.role, 'send_messages')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền gửi tin nhắn trong kênh này' });
    }

    if (req.files && req.files.length > 0) {
      if (!checkPermission(channel, senderId, member.role, 'attach_files')) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền đính kèm tập tin trong kênh này' });
      }
    }

    const attachments = [...parsedForwardedAttachments];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          url: file.path,
          fileType: file.mimetype.startsWith('video/') ? 'video' : 'image',
          name: file.originalname,
        });
      }
    }

    const messageData = {
      sender: senderId,
      content: content ? content.trim() : '',
      channel: channelId,
      community: communityId,
      attachments: attachments,
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const newMessage = await Message.create(messageData);

    const populatedMessage = await Message.findById(newMessage._id)
      .populate({
        path: 'sender',
        select: 'username displayName avatar coins isPremium bannerColor bannerImage activeFrame activeFrameStaticUrl activeFrameAnimatedUrl customStatus activeNameplate activeNameplateStaticUrl activeNameplateAnimatedUrl',
        populate: {
          path: 'activeFrame',
          model: 'Product'
        }
      })
      .populate({
        path: 'replyTo',
        select: 'content sender attachments',
        populate: {
          path: 'sender',
          select: 'username displayName avatar'
        }
      });

    // Broadcast to the room
    const io = getIO();
    io.to(channelId).emit('receive_message', populatedMessage);
    
    // Create notifications for all community members (mention or channel_message)
    const communityWithMembers = await Community.findById(communityId).populate('members.user', 'username displayName name');
    if (communityWithMembers) {
      const senderIdStr = senderId.toString();
      const notificationsToInsert = [];
      const isEveryone = content && content.includes('@everyone');
      const senderDoc = populatedMessage.sender;
      const senderName = senderDoc.displayName || senderDoc.username;
      
      communityWithMembers.members.forEach(member => {
        const u = member.user;
        if (!u) return;
        const uIdStr = u._id.toString();
        if (uIdStr === senderIdStr) return; // Don't notify self

        const settings = member.notificationSettings || { level: 'all', suppressEveryone: false };

        let isMention = false;
        if (content && content.includes('@')) {
          if (isEveryone && !settings.suppressEveryone) {
            isMention = true;
          } else {
            const nameToInsert = u.displayName || u.username;
            const formattedName = nameToInsert.replace(/\s+/g, '');
            const escapedName = formattedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escapedName}(?!\\w)`, 'i');
            if (regex.test(content)) {
              isMention = true;
            }
          }
        }

        if (settings.level === 'none') return;
        if (settings.level === 'mentions' && !isMention) return;

        if (isMention) {
          notificationsToInsert.push({
            recipient: u._id,
            sender: senderId,
            type: 'mention',
            content: isEveryone && !settings.suppressEveryone ? `đã nhắc đến mọi người (@everyone) trong máy chủ ${communityWithMembers.name}` : `đã nhắc đến bạn trong máy chủ ${communityWithMembers.name}`,
            link: `/community/${communityId}/channel/${channelId}`,
            community: communityId
          });
        } else {
          notificationsToInsert.push({
            recipient: u._id,
            sender: senderId,
            type: 'channel_message',
            content: `${senderName} đã gửi một tin nhắn trong máy chủ ${communityWithMembers.name}`,
            link: `/community/${communityId}/channel/${channelId}`,
            community: communityId
          });
        }
      });

      if (notificationsToInsert.length > 0) {
        const inserted = await Notification.insertMany(notificationsToInsert);
        
        const populatedNotifications = await Notification.populate(inserted, { 
          path: 'sender', 
          select: 'username displayName avatar' 
        });

        populatedNotifications.forEach(notif => {
          io.to(`user_${notif.recipient.toString()}`).emit('new_notification', notif);
        });
      }
    }

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error(`🔴 Send Message Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi tin nhắn'
    });
  }
});
// @desc    Edit a message
// @route   PUT /api/messages/:channelId/:messageId
router.put('/:channelId/:messageId', verifyToken, async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    const channel = await Channel.findById(channelId);
    const community = await Community.findById(message.community);
    if (channel && community) {
      const member = community.members.find(m => String(m.user) === String(userId));
      if (!member || !checkPermission(channel, userId, member.role, 'send_messages')) {
        return res.status(403).json({ success: false, message: 'Bạn không thể sửa tin nhắn khi kênh đang bị khóa chat' });
      }
    }

    message.content = content.trim();
    message.isEdited = true;
    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate({
        path: 'sender',
        select: 'username displayName avatar coins isPremium bannerColor bannerImage activeFrame activeFrameStaticUrl activeFrameAnimatedUrl',
        populate: {
          path: 'activeFrame',
          model: 'Product'
        }
      });

    const io = getIO();
    io.to(channelId).emit('message_updated', populatedMessage);

    res.status(200).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error(`🔴 Edit Message Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Delete a message
// @route   DELETE /api/messages/:channelId/:messageId
router.delete('/:channelId/:messageId', verifyToken, async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    let canDelete = String(message.sender) === String(userId);

    if (!canDelete) {
      const channel = await Channel.findById(channelId);
      const community = await Community.findById(message.community);
      if (channel && community) {
        const member = community.members.find(m => String(m.user) === String(userId));
        if (member && checkPermission(channel, userId, member.role, 'manage_messages')) {
          canDelete = true;
        }
      }
    }

    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Permission denied to delete this message' });
    }

    await Message.findByIdAndDelete(messageId);

    const io = getIO();
    io.to(channelId).emit('message_deleted', messageId);

    res.status(200).json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error(`🔴 Delete Message Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// @desc    Toggle a reaction on a message
// @route   POST /api/messages/:channelId/:messageId/reactions
router.post('/:channelId/:messageId/reactions', verifyToken, async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji) {
      return res.status(400).json({ success: false, message: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Find existing reaction with same emoji
    const existingReaction = message.reactions.find(r => r.emoji === emoji);

    if (existingReaction) {
      const userIndex = existingReaction.users.findIndex(u => String(u) === String(userId));
      if (userIndex > -1) {
        // User already reacted -> remove
        existingReaction.users.splice(userIndex, 1);
        if (existingReaction.users.length === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        // Check max 2 reactions per user
        const userReactionCount = message.reactions.filter(r => r.users.some(u => String(u) === String(userId))).length;
        if (userReactionCount >= 2) {
          return res.status(400).json({ success: false, message: 'Bạn chỉ được thả tối đa 2 biểu cảm trên 1 tin nhắn' });
        }
        existingReaction.users.push(userId);
      }
    } else {
      // Check max 2 reactions per user
      const userReactionCount = message.reactions.filter(r => r.users.some(u => String(u) === String(userId))).length;
      if (userReactionCount >= 2) {
        return res.status(400).json({ success: false, message: 'Bạn chỉ được thả tối đa 2 biểu cảm trên 1 tin nhắn' });
      }

      const channel = await Channel.findById(channelId);
      const community = await Community.findById(message.community);
      if (channel && community) {
        const member = community.members.find(m => String(m.user) === String(userId));
        if (!member || !checkPermission(channel, userId, member.role, 'add_reactions')) {
          return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm biểu cảm mới' });
        }
      }

      // Create new reaction
      message.reactions.push({ emoji, users: [userId] });
    }

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate({
        path: 'sender',
        select: 'username displayName avatar coins isPremium bannerColor bannerImage activeFrame activeFrameStaticUrl activeFrameAnimatedUrl',
        populate: { path: 'activeFrame', model: 'Product' }
      })
      .populate({
        path: 'reactions.users',
        select: 'username displayName avatar bannerColor bannerImage'
      });

    const io = getIO();
    io.to(channelId).emit('message_updated', populatedMessage);

    res.status(200).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error(`🔴 Toggle Reaction Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Toggle pin status of a message
// @route   PUT /api/messages/:channelId/:messageId/pin
router.put('/:channelId/:messageId/pin', verifyToken, async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }
    const community = await Community.findById(channel.community);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found' });
    }
    const member = community.members.find(m => m.user.toString() === userId);
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }
    
    // Check permission to manage messages
    if (!checkPermission(channel, userId, member.role, 'manage_messages')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền ghim tin nhắn' });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate({
        path: 'sender',
        select: 'username displayName avatar coins isPremium bannerColor bannerImage activeFrame activeFrameStaticUrl activeFrameAnimatedUrl',
        populate: { path: 'activeFrame', model: 'Product' }
      })
      .populate({
        path: 'reactions.users',
        select: 'username displayName avatar bannerColor bannerImage'
      });

    const io = getIO();
    io.to(channelId).emit('message_updated', populatedMessage);

    res.status(200).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error(`🔴 Toggle Pin Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
