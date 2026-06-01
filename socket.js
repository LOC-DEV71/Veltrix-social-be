const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');
const Community = require('./models/Community');
const Notification = require('./models/Notification');
const Channel = require('./models/Channel');
const { checkPermission } = require('./utils/permissionUtils');

let io;
const onlineUsers = new Map(); // userId -> Set of socket.id

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected to real-time chat: ${socket.id}`);

    // Join a specific channel room
    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
      console.log(`👤 Client ${socket.id} joined channel: ${channelId}`);
    });

    // Join community room for general community events (like unread message badges)
    socket.on('join_community', (communityId) => {
      if (communityId) {
        socket.join(`community_${communityId}`);
      }
    });

    // Leave a channel room
    socket.on('leave_channel', (channelId) => {
      socket.leave(channelId);
      console.log(`👤 Client ${socket.id} left channel: ${channelId}`);
    });

    // Join a specific user private room for notifications (like friend requests)
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.userId = userId;
        socket.join(`user_${userId}`);
        
        // Track online status
        if (!onlineUsers.has(userId)) {
          onlineUsers.set(userId, new Set());
        }
        const userSockets = onlineUsers.get(userId);
        
        // If this is their first connection, broadcast they are online
        if (userSockets.size === 0) {
          io.emit('user_status_change', { userId, isOnline: true });
        }
        userSockets.add(socket.id);
        
        console.log(`👤 Client ${socket.id} registered for private notifications: user_${userId}`);
      }
    });

    // Provide list of all currently online users
    socket.on('get_online_users', (callback) => {
      if (typeof callback === 'function') {
        callback(Array.from(onlineUsers.keys()));
      }
    });

    // Listen for new message events
    socket.on('send_message', async (data) => {
      try {
        const { senderId, content, channelId, communityId, attachments, replyTo } = data;

        if (!senderId || (!content?.trim() && (!attachments || attachments.length === 0))) {
          console.warn('⚠️ Rejected empty or whitespace-only message in socket');
          return;
        }

        if (!channelId || !communityId) {
          console.warn('⚠️ Rejected message without channelId or communityId');
          return;
        }

        const channel = await Channel.findById(channelId);
        if (!channel) return;
        const community = await Community.findById(communityId);
        if (!community) return;
        
        const member = community.members.find(m => m.user.toString() === senderId);
        if (!member || !checkPermission(channel, senderId, member.role, 'send_messages')) {
          console.warn('⚠️ Rejected message due to lack of send_messages permission');
          return;
        }

        // Save message to database using correct schema field names
        const messageData = {
          sender: senderId,
          content: content ? content.trim() : '',
          channel: channelId,
          community: communityId,
          attachments: attachments || [],
        };
        if (replyTo) {
          messageData.replyTo = replyTo;
        }
        const newMessage = await Message.create(messageData);

        // Populate sender info (including username, avatar, displayName, frames, etc.)
        const populatedMessage = await Message.findById(newMessage._id)
          .populate({
            path: 'sender',
            select: 'username displayName avatar coins isPremium bannerColor bannerImage activeFrame activeFrameStaticUrl activeFrameAnimatedUrl customStatus activeNameplate activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl themeColors',
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

        // Broadcast to all clients in the channel room
        io.to(channelId).emit('receive_message', populatedMessage);
        
        // Create notifications for all community members (mention or channel_message)
        const populatedCommunity = await Community.findById(communityId).populate('members.user', 'username displayName name');
        if (populatedCommunity) {
          const senderIdStr = senderId.toString();
          const notificationsToInsert = [];
          const isEveryone = content && content.includes('@everyone');
          const senderDoc = populatedMessage.sender;
          const senderName = senderDoc.displayName || senderDoc.username;
          
          populatedCommunity.members.forEach(member => {
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
                content: isEveryone && !settings.suppressEveryone ? `đã nhắc đến mọi người (@everyone) trong máy chủ ${populatedCommunity.name}` : `đã nhắc đến bạn trong máy chủ ${populatedCommunity.name}`,
                link: `/community/${communityId}/channel/${channelId}`,
                community: communityId
              });
            } else {
              notificationsToInsert.push({
                recipient: u._id,
                sender: senderId,
                type: 'channel_message',
                content: `${senderName} đã gửi một tin nhắn trong máy chủ ${populatedCommunity.name}`,
                link: `/community/${communityId}/channel/${channelId}`,
                community: communityId
              });
            }
          });

          if (notificationsToInsert.length > 0) {
            const inserted = await Notification.insertMany(notificationsToInsert);
            
            // Populate sender for notifications to send full data
            const populatedNotifications = await Notification.populate(inserted, { 
              path: 'sender', 
              select: 'username displayName avatar' 
            });

            populatedNotifications.forEach(notif => {
              io.to(`user_${notif.recipient.toString()}`).emit('new_notification', notif);
            });
          }
        }
        
      } catch (error) {
        console.error(`🔴 Socket send_message Error: ${error.message}`);
        socket.emit('message_error', { message: 'Lỗi khi gửi tin nhắn' });
      }
    });

    // Typing indicator
    socket.on('typing_start', ({ channelId, user }) => {
      socket.to(channelId).emit('user_typing', { user, channelId });
    });

    socket.on('typing_stop', ({ channelId, user }) => {
      socket.to(channelId).emit('user_stop_typing', { user, channelId });
    });

    // ==================== VOICE CHANNEL ====================
    // Track users in voice channels: channelId -> [ { _id, username, displayName, avatar, isPremium, socketId } ]
    if (!io.voiceChannels) io.voiceChannels = {};

    socket.on('voice_join', ({ channelId, communityId, user: voiceUser }) => {
      if (!channelId || !voiceUser) return;

      if (!io.voiceChannels[channelId]) {
        io.voiceChannels[channelId] = [];
      }

      // Remove any existing entry for this user (in case of reconnect)
      io.voiceChannels[channelId] = io.voiceChannels[channelId].filter(u => u._id !== voiceUser._id);

      // Add user
      const userData = { ...voiceUser, socketId: socket.id };
      io.voiceChannels[channelId].push(userData);

      // Store voice channel info on socket for cleanup
      socket.voiceChannelId = channelId;
      socket.voiceUserId = voiceUser._id;

      // Join socket room for the voice channel
      socket.join(`voice_${channelId}`);

      // Send current users list to the joining user
      socket.emit('voice_users', io.voiceChannels[channelId]);

      // Notify others in the channel
      socket.to(`voice_${channelId}`).emit('voice_user_joined', userData);

      // Broadcast to community sidebar for showing who's in voice
      io.to(`community_${communityId}`).emit('voice_channel_update', {
        channelId,
        users: io.voiceChannels[channelId]
      });

      console.log(`🎤 ${voiceUser.username} joined voice channel ${channelId}`);
    });

    socket.on('voice_state_update', ({ channelId, state }) => {
      if (channelId && socket.voiceUserId) {
        socket.to(`voice_${channelId}`).emit('voice_state_updated', { userId: socket.voiceUserId, state });
      }
    });

    socket.on('voice_leave', ({ channelId }) => {
      if (!channelId || !io.voiceChannels[channelId]) return;

      const leftUser = io.voiceChannels[channelId].find(u => u.socketId === socket.id);
      io.voiceChannels[channelId] = io.voiceChannels[channelId].filter(u => u.socketId !== socket.id);

      socket.leave(`voice_${channelId}`);
      socket.voiceChannelId = null;
      socket.voiceUserId = null;

      if (leftUser) {
        io.to(`voice_${channelId}`).emit('voice_user_left', leftUser._id);
        console.log(`🎤 ${leftUser.username} left voice channel ${channelId}`);
      }

      // Clean up empty channels
      if (io.voiceChannels[channelId].length === 0) {
        delete io.voiceChannels[channelId];
      }

      // Update sidebar
      io.emit('voice_channel_update', {
        channelId,
        users: io.voiceChannels[channelId] || []
      });
    });

    // WebRTC Signaling relay
    socket.on('voice_offer', ({ to, offer }) => {
      // Find the target socket
      const targetChannel = socket.voiceChannelId;
      if (!targetChannel || !io.voiceChannels[targetChannel]) return;
      const targetUser = io.voiceChannels[targetChannel].find(u => u._id === to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('voice_offer', { from: socket.voiceUserId, offer });
      }
    });

    socket.on('voice_answer', ({ to, answer }) => {
      const targetChannel = socket.voiceChannelId;
      if (!targetChannel || !io.voiceChannels[targetChannel]) return;
      const targetUser = io.voiceChannels[targetChannel].find(u => u._id === to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('voice_answer', { from: socket.voiceUserId, answer });
      }
    });

    socket.on('voice_ice_candidate', ({ to, candidate }) => {
      const targetChannel = socket.voiceChannelId;
      if (!targetChannel || !io.voiceChannels[targetChannel]) return;
      const targetUser = io.voiceChannels[targetChannel].find(u => u._id === to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('voice_ice_candidate', { from: socket.voiceUserId, candidate });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected from chat: ${socket.id}`);
      
      // Clean up voice channel
      if (socket.voiceChannelId && io.voiceChannels) {
        const vcId = socket.voiceChannelId;
        if (io.voiceChannels[vcId]) {
          const leftUser = io.voiceChannels[vcId].find(u => u.socketId === socket.id);
          io.voiceChannels[vcId] = io.voiceChannels[vcId].filter(u => u.socketId !== socket.id);
          
          if (leftUser) {
            io.to(`voice_${vcId}`).emit('voice_user_left', leftUser._id);
          }
          
          if (io.voiceChannels[vcId].length === 0) {
            delete io.voiceChannels[vcId];
          }

          io.emit('voice_channel_update', {
            channelId: vcId,
            users: io.voiceChannels[vcId] || []
          });
        }
      }

      if (socket.userId) {
        const userSockets = onlineUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(socket.userId);
            io.emit('user_status_change', { userId: socket.userId, isOnline: false });
          }
        }
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
