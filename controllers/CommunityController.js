const Community = require('../models/Community');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const User = require('../models/User');
const { checkPermission } = require('../utils/permissionUtils');

// Template-based default channels
// Each template creates specific text channels + shared voice channels
const CHANNEL_TEMPLATES = {
  custom: {
    text: ['chào-mừng', 'chung'],
  },
  gaming: {
    text: ['chung', 'trò-chơi', 'clip-và-highlight', 'tìm-đồng-đội'],
  },
  friends: {
    text: ['chung', 'trò-chơi', 'âm-nhạc'],
  },
  study: {
    text: ['chung', 'bài-tập', 'tài-liệu', 'hỏi-đáp'],
  },
  school: {
    text: ['chung', 'thông-báo', 'sự-kiện', 'hoạt-động'],
  },
  community: {
    text: ['chung', 'thông-báo', 'giới-thiệu', 'sự-kiện'],
  },
  creator: {
    text: ['chung', 'showcase', 'feedback', 'cảm-hứng'],
  },
};

// Default voice channels — ALL templates get these
const DEFAULT_VOICE_CHANNELS = ['Phòng chờ', 'Phòng Stream'];

// @desc    Create a new community (server) with template-based channels
// @route   POST /api/communities
// @access  Private
exports.createCommunity = async (req, res) => {
  try {
    const { name, icon, description, template, purpose } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên cộng đồng' });
    }

    // Create the community
    const community = await Community.create({
      name,
      icon,
      description,
      owner: req.user.id,
      members: [{ user: req.user.id, role: 'owner' }],
    });

    // Determine which text channels to create based on template
    const templateKey = CHANNEL_TEMPLATES[template] ? template : 'custom';
    const textChannelNames = CHANNEL_TEMPLATES[templateKey].text;

    // Create text channels
    const createdChannels = [];
    for (let i = 0; i < textChannelNames.length; i++) {
      const ch = await Channel.create({
        name: textChannelNames[i],
        type: 'text',
        community: community._id,
        order: i,
      });
      createdChannels.push(ch);
    }

    // Create voice channels (same for all templates)
    for (let i = 0; i < DEFAULT_VOICE_CHANNELS.length; i++) {
      const ch = await Channel.create({
        name: DEFAULT_VOICE_CHANNELS[i],
        type: 'voice',
        community: community._id,
        order: textChannelNames.length + i,
      });
      createdChannels.push(ch);
    }

    res.status(201).json({
      success: true,
      data: {
        community,
        channels: createdChannels,
      },
    });
  } catch (error) {
    console.error('Create Community Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo cộng đồng' });
  }
};

// @desc    Get all communities for the logged in user
// @route   GET /api/communities
// @access  Private
exports.getMyCommunities = async (req, res) => {
  try {
    // Find communities where the user is in the members array
    const communities = await Community.find({
      'members.user': req.user.id
    })
    .populate('members.user', 'username displayName avatar activeFrameAnimatedUrl activeFrameStaticUrl activeNameplateAnimatedUrl activeNameplateStaticUrl role isPremium bannerColor bannerImage customStatus')
    .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: communities,
    });
  } catch (error) {
    console.error('Get Communities Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách cộng đồng' });
  }
};

// @desc    Get channels for a specific community
// @route   GET /api/communities/:id/channels
// @access  Private
exports.getCommunityChannels = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên' });
    }

    const channels = await Channel.find({ community: req.params.id }).sort('order');
    
    // Filter channels based on view_channel permission
    const visibleChannels = channels.filter(channel => {
      return checkPermission(channel, req.user.id, member.role, 'view_channel');
    });

    res.status(200).json({
      success: true,
      data: visibleChannels,
    });
  } catch (error) {
    console.error('Get Channels Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách kênh' });
  }
};

// @desc    Get a single community with members populated
// @route   GET /api/communities/:id
// @access  Private
exports.getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate('members.user', 'username displayName avatar activeFrameAnimatedUrl activeFrameStaticUrl activeNameplateAnimatedUrl activeNameplateStaticUrl role isPremium bannerColor bannerImage customStatus');

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cộng đồng' });
    }

    res.status(200).json({
      success: true,
      data: community,
    });
  } catch (error) {
    console.error('Get Community Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// @desc    Join a community (via invite link or direct add)
// @route   POST /api/communities/:id/join
// @access  Private
exports.joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    // Check if user is already a member
    const isMember = community.members.some(
      (m) => m.user.toString() === req.user.id
    );

    const User = require('../models/User'); // Import User model

    if (isMember) {
      // Clean up the invite if it exists but they are already a member
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { communityInvites: { community: community._id } }
      });
      return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của máy chủ này' });
    }

    // Add user to community members
    community.members.push({ user: req.user.id, role: 'member' });
    await community.save();

    // Remove the invite
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { communityInvites: { community: community._id } }
    });

    res.status(200).json({
      success: true,
      message: 'Đã tham gia máy chủ thành công',
      data: community
    });

    // Notify the community owner
    const Notification = require('../models/Notification');
    const { getIO } = require('../socket');
    if (community.owner.toString() !== req.user.id) {
      const notification = new Notification({
        recipient: community.owner,
        sender: req.user.id,
        type: 'community_join',
        content: `đã tham gia máy chủ ${community.name} của bạn`,
        community: community._id,
        link: '/friends'
      });
      await notification.save();

      const io = getIO();
      const populatedNotif = await Notification.findById(notification._id)
        .populate('sender', 'username displayName avatar')
        .populate('community', 'name icon');

      io.to(`user_${community.owner.toString()}`).emit('new_notification', populatedNotif);
    }
  } catch (error) {
    console.error('Join Community Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tham gia cộng đồng' });
  }
};

// @desc    Add a friend directly to community (Send Invite)
// @route   POST /api/communities/:id/add-member
// @access  Private
exports.addMember = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    // Check if target is already a member
    const isMember = community.members.some(
      (m) => m.user.toString() === targetUserId
    );

    if (isMember) {
      return res.status(400).json({ success: false, message: 'Người này đã là thành viên' });
    }

    // Instead of adding immediately, push to their communityInvites
    const User = require('../models/User'); // Import User inside or top
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    // Check if already invited
    const isInvited = targetUser.communityInvites.some(
      (invite) => invite.community.toString() === community._id.toString()
    );

    if (isInvited) {
      return res.status(400).json({ success: false, message: 'Đã gửi lời mời rồi' });
    }

    targetUser.communityInvites.push({
      community: community._id,
      inviter: req.user.id
    });

    await targetUser.save();

    const Notification = require('../models/Notification');
    const { getIO } = require('../socket');

    const notification = new Notification({
      recipient: targetUser._id,
      sender: req.user.id,
      type: 'community_invite',
      content: `đã mời bạn tham gia máy chủ ${community.name}`,
      community: community._id,
      link: '/friends'
    });
    await notification.save();

    const io = getIO();
    const populatedNotif = await Notification.findById(notification._id)
      .populate('sender', 'username displayName avatar')
      .populate('community', 'name icon');

    io.to(`user_${targetUser._id.toString()}`).emit('new_notification', populatedNotif);
    io.to(`user_${targetUser._id.toString()}`).emit('community_invite_received', populatedNotif);

    res.status(200).json({
      success: true,
      message: 'Đã gửi lời mời thành công',
      data: community
    });
  } catch (error) {
    console.error('Add Member Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm thành viên' });
  }
};

// @desc    Update a member's role
// @route   PUT /api/communities/:id/member-role
// @access  Private
exports.updateMemberRole = async (req, res) => {
  try {
    const { memberId } = req.body; // memberId is user's ID
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    // Only owner can change roles
    const requester = community.members.find(m => m.user.toString() === req.user.id);
    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Chỉ có chủ sở hữu mới có quyền thay đổi vai trò' });
    }

    const memberToUpdate = community.members.find(m => m.user.toString() === memberId);
    if (!memberToUpdate) {
      return res.status(404).json({ success: false, message: 'Thành viên không tồn tại trong máy chủ' });
    }

    if (memberToUpdate.role === 'owner') {
      return res.status(400).json({ success: false, message: 'Không thể thay đổi vai trò của chủ sở hữu' });
    }

    // Toggle role
    memberToUpdate.role = memberToUpdate.role === 'admin' ? 'member' : 'admin';

    await community.save();

    // Populate user to return the updated member with user details
    await community.populate('members.user', 'username displayName avatar activeFrameAnimatedUrl activeFrameStaticUrl activeNameplateAnimatedUrl activeNameplateStaticUrl role isPremium bannerColor bannerImage customStatus');
    
    // Get the updated member
    const updatedMember = community.members.find(m => m.user._id.toString() === memberId);

    res.status(200).json({
      success: true,
      message: `Đã ${updatedMember.role === 'admin' ? 'cấp quyền' : 'gỡ quyền'} Quản trị viên`,
      data: updatedMember
    });
  } catch (error) {
    console.error('Update Member Role Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thay đổi vai trò' });
  }
};

// @desc    Kick a member from community
// @route   DELETE /api/communities/:id/members/:memberId
// @access  Private
exports.kickMember = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const { memberId } = req.params;

    // Check requester role
    const requester = community.members.find(m => m.user.toString() === req.user.id);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền kick thành viên' });
    }

    // Check target member
    const targetMember = community.members.find(m => m.user.toString() === memberId);
    if (!targetMember) {
      return res.status(404).json({ success: false, message: 'Thành viên không tồn tại trong máy chủ' });
    }

    // Admins cannot kick owners or other admins
    if (requester.role === 'admin' && targetMember.role !== 'member') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền kick người này' });
    }
    
    // Owners cannot kick themselves
    if (targetMember.role === 'owner') {
      return res.status(400).json({ success: false, message: 'Không thể kick chủ sở hữu' });
    }

    // Remove member
    community.members = community.members.filter(m => m.user.toString() !== memberId);
    await community.save();

    res.status(200).json({
      success: true,
      message: 'Đã kick thành viên thành công'
    });
  } catch (error) {
    console.error('Kick Member Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi kick thành viên' });
  }
};

// @desc    Decline a community invite
// @route   POST /api/communities/:id/decline-invite
// @access  Private
exports.declineCommunityInvite = async (req, res) => {
  try {
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { communityInvites: { community: req.params.id } }
    });
    res.status(200).json({ success: true, message: 'Đã từ chối lời mời' });
  } catch (error) {
    console.error('Decline Invite Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi từ chối lời mời' });
  }
};

// @desc    Create a new channel in a community
// @route   POST /api/communities/:id/channels
// @access  Private
exports.createChannel = async (req, res) => {
  try {
    const { name, type } = req.body;
    const communityId = req.params.id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên kênh không được để trống' });
    }

    const validTypes = ['text', 'voice'];
    const channelType = validTypes.includes(type) ? type : 'text';

    // Verify community exists and user is owner/admin
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Cộng đồng không tồn tại' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tạo kênh trong máy chủ này' });
    }

    const channel = await Channel.create({
      community: communityId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type: channelType
    });

    res.status(201).json({
      success: true,
      data: channel,
      message: 'Đã tạo kênh thành công'
    });
  } catch (error) {
    console.error('Create Channel Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo kênh' });
  }
};

// @desc    Update community settings
// @route   PUT /api/communities/:id
// @access  Private
exports.updateCommunity = async (req, res) => {
  try {
    const { name, icon, banner, isBoosted } = req.body;
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    // Verify ownership or admin
    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa' });
    }

    if (name) community.name = name;
    if (icon !== undefined) community.icon = icon;
    if (banner !== undefined) community.banner = banner;
    if (isBoosted !== undefined) community.isBoosted = isBoosted;

    await community.save();

    res.status(200).json({
      success: true,
      data: community,
      message: 'Đã cập nhật máy chủ'
    });
  } catch (error) {
    console.error('Update Community Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật' });
  }
};

// @desc    Upload community icon
// @route   POST /api/communities/:id/icon
// @access  Private
exports.updateCommunityIcon = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh tải lên' });
    }

    community.icon = req.file.path; // Cloudinary URL
    await community.save();

    res.status(200).json({
      success: true,
      data: community,
      message: 'Đã cập nhật biểu tượng máy chủ'
    });
  } catch (error) {
    console.error('Update Community Icon Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật biểu tượng' });
  }
};

// @desc    Upload community banner
// @route   POST /api/communities/:id/banner
// @access  Private
exports.updateCommunityBanner = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh tải lên' });
    }

    community.banner = req.file.path; // Cloudinary URL
    await community.save();

    res.status(200).json({
      success: true,
      data: community,
      message: 'Đã cập nhật biểu ngữ máy chủ'
    });
  } catch (error) {
    console.error('Update Community Banner Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật biểu ngữ' });
  }
};

// @desc    Upload community badge
// @route   POST /api/communities/:id/badge
// @access  Private
exports.updateCommunityBadge = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh tải lên' });
    }

    community.serverBadge = req.file.path; // Cloudinary URL
    await community.save();

    res.status(200).json({
      success: true,
      data: community,
      message: 'Đã cập nhật huy hiệu máy chủ'
    });
  } catch (error) {
    console.error('Update Community Badge Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật huy hiệu' });
  }
};

// @desc    Update channel
// @route   PUT /api/communities/:id/channels/:channelId
// @access  Private
exports.updateChannel = async (req, res) => {
  try {
    const { name, topic, slowMode, nsfw } = req.body;
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa kênh' });
    }

    const channel = await Channel.findOne({ _id: req.params.channelId, community: req.params.id });
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kênh' });
    }

    if (name) channel.name = name;
    if (topic !== undefined) channel.topic = topic;
    if (slowMode !== undefined) channel.slowMode = slowMode;
    if (nsfw !== undefined) channel.nsfw = nsfw;
    if (req.body.permissionOverwrites !== undefined) channel.permissionOverwrites = req.body.permissionOverwrites;

    await channel.save();

    res.status(200).json({
      success: true,
      data: channel,
      message: 'Cập nhật kênh thành công'
    });
  } catch (error) {
    console.error('Update Channel Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật kênh' });
  }
};

// @desc    Delete channel
// @route   DELETE /api/communities/:id/channels/:channelId
// @access  Private
exports.deleteChannel = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa kênh' });
    }

    const channel = await Channel.findOne({ _id: req.params.channelId, community: req.params.id });
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kênh' });
    }

    // Don't allow deleting the last channel
    const channelCount = await Channel.countDocuments({ community: req.params.id });
    if (channelCount <= 1) {
      return res.status(400).json({ success: false, message: 'Không thể xóa kênh cuối cùng của máy chủ' });
    }

    await channel.deleteOne();
    // Also delete all messages in this channel
    await Message.deleteMany({ channel: req.params.channelId });

    res.status(200).json({
      success: true,
      message: 'Đã xóa kênh'
    });
  } catch (error) {
    console.error('Delete Channel Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa kênh' });
  }
};

// @desc    Update notification settings for a member in a community
// @route   PUT /api/communities/:id/notification-settings
// @access  Private
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { level, suppressEveryone, suppressRoles, suppressHighlights, muteEvents, mobilePush } = req.body;
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cộng đồng' });
    }

    const memberIndex = community.members.findIndex(m => String(m.user) === String(req.user.id));
    if (memberIndex === -1) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên' });
    }

    if (!community.members[memberIndex].notificationSettings) {
      community.members[memberIndex].notificationSettings = {
        level: 'all',
        suppressEveryone: false,
        suppressRoles: false,
        suppressHighlights: false,
        muteEvents: false,
        mobilePush: true
      };
    }

    if (level !== undefined) community.members[memberIndex].notificationSettings.level = level;
    if (suppressEveryone !== undefined) community.members[memberIndex].notificationSettings.suppressEveryone = suppressEveryone;
    if (suppressRoles !== undefined) community.members[memberIndex].notificationSettings.suppressRoles = suppressRoles;
    if (suppressHighlights !== undefined) community.members[memberIndex].notificationSettings.suppressHighlights = suppressHighlights;
    if (muteEvents !== undefined) community.members[memberIndex].notificationSettings.muteEvents = muteEvents;
    if (mobilePush !== undefined) community.members[memberIndex].notificationSettings.mobilePush = mobilePush;

    await community.save();
    res.status(200).json({ success: true, data: community.members[memberIndex].notificationSettings });
  } catch (error) {
    console.error('Update Notification Settings Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// @desc    Delete community
// @route   DELETE /api/communities/:id
// @access  Private (Owner only)
exports.deleteCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    }

    if (String(community.owner) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ sở hữu mới có quyền xóa máy chủ này' });
    }

    // You must import Channel if not already available in this file. It should be available at the top.
    const Channel = require('../models/Channel');
    await Channel.deleteMany({ community: communityId });
    await community.deleteOne();

    res.status(200).json({ success: true, message: 'Đã xóa máy chủ thành công' });
  } catch (error) {
    console.error('Delete Community Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xóa máy chủ' });
  }
};

// @desc    Upload community emoji
// @route   POST /api/communities/:id/emojis
// @access  Private
exports.uploadCommunityEmoji = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    
    if (!community.boost2) return res.status(403).json({ success: false, message: 'Yêu cầu Đặc Quyền Cấp 2' });

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền tải lên emoji' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'Không tìm thấy file tải lên' });

    if (community.emojis.length >= 50) {
      return res.status(400).json({ success: false, message: 'Đã đạt giới hạn 50 emoji' });
    }

    const newEmoji = {
      name: req.body.name || req.file.originalname.split('.')[0] || 'emoji',
      url: req.file.path,
      uploadedBy: req.user.id
    };

    community.emojis.push(newEmoji);
    await community.save();

    res.status(200).json({ success: true, data: community.emojis, message: 'Tải lên emoji thành công' });
  } catch (error) {
    console.error('Upload Emoji Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải lên emoji' });
  }
};

// @desc    Delete community emoji
// @route   DELETE /api/communities/:id/emojis/:emojiId
// @access  Private
exports.deleteCommunityEmoji = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    
    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa emoji' });
    }

    community.emojis = community.emojis.filter(e => e._id.toString() !== req.params.emojiId);
    await community.save();

    res.status(200).json({ success: true, data: community.emojis, message: 'Đã xóa emoji' });
  } catch (error) {
    console.error('Delete Emoji Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa emoji' });
  }
};

// @desc    Upload community sticker
// @route   POST /api/communities/:id/stickers
// @access  Private
exports.uploadCommunitySticker = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    
    if (!community.boost2) return res.status(403).json({ success: false, message: 'Yêu cầu Đặc Quyền Cấp 2' });

    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền tải lên nhãn dán' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'Không tìm thấy file tải lên' });

    if (community.stickers.length >= 15) {
      return res.status(400).json({ success: false, message: 'Đã đạt giới hạn 15 nhãn dán' });
    }

    const newSticker = {
      name: req.body.name || req.file.originalname.split('.')[0] || 'sticker',
      url: req.file.path,
      uploadedBy: req.user.id
    };

    community.stickers.push(newSticker);
    await community.save();

    res.status(200).json({ success: true, data: community.stickers, message: 'Tải lên nhãn dán thành công' });
  } catch (error) {
    console.error('Upload Sticker Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải lên nhãn dán' });
  }
};

// @desc    Delete community sticker
// @route   DELETE /api/communities/:id/stickers/:stickerId
// @access  Private
exports.deleteCommunitySticker = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    
    const member = community.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa nhãn dán' });
    }

    community.stickers = community.stickers.filter(s => s._id.toString() !== req.params.stickerId);
    await community.save();

    res.status(200).json({ success: true, data: community.stickers, message: 'Đã xóa nhãn dán' });
  } catch (error) {
    console.error('Delete Sticker Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa nhãn dán' });
  }
};

// @desc    Update member's server profile
// @route   POST /api/communities/:id/server-profile
// @access  Private
exports.updateServerProfile = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: 'Không tìm thấy máy chủ' });
    
    const memberIndex = community.members.findIndex(m => m.user.toString() === req.user.id);
    if (memberIndex === -1) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên của máy chủ này' });
    }

    const { nickname, removeAvatar } = req.body;

    if (nickname !== undefined) {
      community.members[memberIndex].nickname = nickname || null;
    }

    if (removeAvatar === 'true') {
      community.members[memberIndex].avatar = null;
    } else if (req.file) {
      community.members[memberIndex].avatar = req.file.path; // Cloudinary URL
    }

    await community.save();

    res.status(200).json({ 
      success: true, 
      data: community.members[memberIndex], 
      message: 'Cập nhật hồ sơ máy chủ thành công' 
    });
  } catch (error) {
    console.error('Update Server Profile Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật hồ sơ máy chủ' });
  }
};
