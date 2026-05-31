const Notification = require('../models/Notification');
const { getIO } = require('../socket');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'username displayName avatar')
      .populate('community', 'name icon')
      .sort({ createdAt: -1 })
      .limit(50); // Get latest 50 notifications

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải thông báo' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đọc thông báo' });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'Đã đánh dấu tất cả là đã đọc' });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
// @desc    Mark all notifications in a community as read
// @route   PUT /api/notifications/read-community/:communityId
// @access  Private
exports.markCommunityAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, community: req.params.communityId, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc máy chủ' });
  } catch (error) {
    console.error('Mark Community Read Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// @desc    Mark all notifications in a channel as read
// @route   PUT /api/notifications/read-channel/:channelId
// @access  Private
exports.markChannelAsRead = async (req, res) => {
  try {
    // link contains the channelId
    await Notification.updateMany(
      { 
        recipient: req.user.id, 
        isRead: false,
        link: { $regex: req.params.channelId, $options: 'i' }
      },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc kênh' });
  } catch (error) {
    console.error('Mark Channel Read Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
