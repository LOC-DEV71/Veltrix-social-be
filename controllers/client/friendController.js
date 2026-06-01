const User = require('../../models/User');
const { getIO } = require('../../socket');

// Lấy danh sách bạn bè, yêu cầu kết bạn, người bị chặn
exports.getFriendsData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'friends',
        select: 'username displayName avatar activeFrame activeNameplate isPremium activeFrameStaticUrl activeFrameAnimatedUrl activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl',
        populate: [
          { path: 'activeFrame', select: 'staticUrl animatedUrl name' },
          { path: 'activeNameplate', select: 'staticUrl animatedUrl name' }
        ]
      })
      .populate({
        path: 'friendRequests.user',
        select: 'username displayName avatar activeFrame activeNameplate isPremium activeFrameStaticUrl activeFrameAnimatedUrl activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl',
        populate: [
          { path: 'activeFrame', select: 'staticUrl animatedUrl name' },
          { path: 'activeNameplate', select: 'staticUrl animatedUrl name' }
        ]
      })
      .populate('blockedUsers', 'username displayName avatar activeFrame isPremium')
      .populate({
        path: 'communityInvites.community',
        select: 'name icon'
      })
      .populate({
        path: 'communityInvites.inviter',
        select: 'username displayName avatar'
      });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      data: {
        friends: user.friends,
        friendRequests: user.friendRequests,
        blockedUsers: user.blockedUsers,
        communityInvites: user.communityInvites
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Gửi yêu cầu kết bạn
exports.sendFriendRequest = async (req, res) => {
  try {
    const { targetUsername } = req.body;
    const senderId = req.user.id;

    if (!targetUsername) return res.status(400).json({ success: false, message: 'Missing target username' });

    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng này!' });

    if (targetUser._id.toString() === senderId.toString()) {
      return res.status(400).json({ success: false, message: 'Bạn không thể kết bạn với chính mình!' });
    }

    const sender = await User.findById(senderId);

    // Kiểm tra xem đã là bạn bè chưa
    if (sender.friends.includes(targetUser._id)) {
      return res.status(400).json({ success: false, message: 'Các bạn đã là bạn bè rồi!' });
    }

    // Kiểm tra xem đã gửi yêu cầu chưa
    const alreadySent = sender.friendRequests.some(req => req.user.toString() === targetUser._id.toString());
    if (alreadySent) {
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu kết bạn cho người này rồi, hoặc họ đã gửi cho bạn!' });
    }

    // Thêm outgoing request cho sender
    sender.friendRequests.push({ user: targetUser._id, type: 'outgoing', status: 'pending' });
    await sender.save();

    // Thêm incoming request cho target
    targetUser.friendRequests.push({ user: senderId, type: 'incoming', status: 'pending' });
    await targetUser.save();

    // Lấy thông tin người gửi để báo cho người nhận realtime
    const populatedSender = await User.findById(senderId)
      .select('username displayName avatar activeFrame activeNameplate isPremium activeFrameStaticUrl activeFrameAnimatedUrl activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl')
      .populate('activeFrame', 'staticUrl animatedUrl name')
      .populate('activeNameplate', 'staticUrl animatedUrl name');

    // Emit Realtime event
    const io = getIO();
    io.to(`user_${targetUser._id.toString()}`).emit('friend_request_received', {
      user: populatedSender,
      type: 'incoming',
      status: 'pending',
      createdAt: new Date()
    });

    // Create Notification
    const Notification = require('../../models/Notification');
    const notification = new Notification({
      recipient: targetUser._id,
      sender: senderId,
      type: 'friend_request',
      content: 'đã gửi cho bạn một yêu cầu kết bạn',
      link: '/friends'
    });
    await notification.save();
    
    const populatedNotif = await Notification.findById(notification._id)
      .populate('sender', 'username displayName avatar');
      
    io.to(`user_${targetUser._id.toString()}`).emit('new_notification', populatedNotif);

    res.status(200).json({ success: true, message: 'Đã gửi yêu cầu kết bạn!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Chấp nhận yêu cầu
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { targetId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetId);

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    // Xóa request từ 2 phía
    user.friendRequests = user.friendRequests.filter(r => r.user.toString() !== targetId);
    targetUser.friendRequests = targetUser.friendRequests.filter(r => r.user.toString() !== userId);

    // Thêm vào danh sách friends
    if (!user.friends.includes(targetId)) user.friends.push(targetId);
    if (!targetUser.friends.includes(userId)) targetUser.friends.push(userId);

    await user.save();
    await targetUser.save();

    const populatedUser = await User.findById(userId).select('username displayName avatar activeFrame isPremium');
    const populatedTarget = await User.findById(targetId).select('username displayName avatar activeFrame isPremium');

    const io = getIO();
    io.to(`user_${targetId}`).emit('friend_request_accepted', {
      friend: populatedUser
    });
    io.to(`user_${userId}`).emit('friend_request_accepted', {
      friend: populatedTarget
    });

    // Create Notification
    const Notification = require('../../models/Notification');
    const notification = new Notification({
      recipient: targetId,
      sender: userId,
      type: 'friend_accept',
      content: 'đã chấp nhận yêu cầu kết bạn của bạn',
      link: '/friends'
    });
    await notification.save();
    
    const populatedNotif = await Notification.findById(notification._id)
      .populate('sender', 'username displayName avatar');
      
    io.to(`user_${targetId}`).emit('new_notification', populatedNotif);

    res.status(200).json({ success: true, message: 'Đã chấp nhận kết bạn!', friend: populatedTarget });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Từ chối / Hủy yêu cầu
exports.declineFriendRequest = async (req, res) => {
  try {
    const { targetId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetId);

    if (user) {
      user.friendRequests = user.friendRequests.filter(r => r.user.toString() !== targetId);
      await user.save();
    }
    
    if (targetUser) {
      targetUser.friendRequests = targetUser.friendRequests.filter(r => r.user.toString() !== userId);
      await targetUser.save();
    }

    res.status(200).json({ success: true, message: 'Đã hủy yêu cầu.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa bạn
exports.removeFriend = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetId);

    if (user) {
      user.friends = user.friends.filter(id => id.toString() !== targetId);
      await user.save();
    }

    if (targetUser) {
      targetUser.friends = targetUser.friends.filter(id => id.toString() !== userId);
      await targetUser.save();
      
      const io = getIO();
      io.to(`user_${targetId}`).emit('friend_removed', { userId });
    }

    res.status(200).json({ success: true, message: 'Đã hủy kết bạn.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách bạn chung
exports.getMutualFriends = async (req, res) => {
  try {
    const targetId = req.params.userId;
    const currentUserId = req.user.id;

    if (targetId === currentUserId) {
      return res.status(200).json({ success: true, mutualFriends: [] });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    // Convert friends arrays to strings for intersection
    const currentUserFriends = currentUser.friends.map(id => id.toString());
    const targetUserFriends = targetUser.friends.map(id => id.toString());

    const mutualFriendIds = currentUserFriends.filter(id => targetUserFriends.includes(id));

    const mutualFriends = await User.find({ _id: { $in: mutualFriendIds } })
      .select('username displayName avatar activeFrame activeNameplate isPremium bannerColor bannerImage themeColors customStatus activeFrameStaticUrl activeFrameAnimatedUrl activeNameplateStaticUrl activeNameplateAnimatedUrl activeProfileEffectStaticUrl activeProfileEffectAnimatedUrl')
      .populate('activeFrame', 'staticUrl animatedUrl name')
      .populate('activeNameplate', 'staticUrl animatedUrl name');

    res.status(200).json({ success: true, mutualFriends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
