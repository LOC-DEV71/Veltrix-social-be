const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { createCommunity, getMyCommunities, getCommunityChannels, getCommunityById, joinCommunity, addMember, declineCommunityInvite, createChannel, updateCommunity, updateCommunityIcon, updateCommunityBanner, updateCommunityBadge, updateMemberRole, kickMember, updateChannel, deleteChannel, updateNotificationSettings, deleteCommunity, uploadCommunityEmoji, deleteCommunityEmoji, uploadCommunitySticker, deleteCommunitySticker, updateServerProfile } = require('../controllers/CommunityController');
const { upload } = require('../config/cloudinary');

// All routes require authentication
router.use(verifyToken);

router.route('/')
  .post(createCommunity)
  .get(getMyCommunities);

router.route('/:id')
  .get(getCommunityById)
  .put(updateCommunity)
  .delete(deleteCommunity);

router.post('/:id/icon', upload.single('icon'), updateCommunityIcon);
router.post('/:id/banner', upload.single('banner'), updateCommunityBanner);
router.post('/:id/badge', upload.single('badge'), updateCommunityBadge);

router.post('/:id/emojis', upload.single('emoji'), uploadCommunityEmoji);
router.delete('/:id/emojis/:emojiId', deleteCommunityEmoji);

router.post('/:id/stickers', upload.single('sticker'), uploadCommunitySticker);
router.delete('/:id/stickers/:stickerId', deleteCommunitySticker);

router.route('/:id/channels')
  .get(getCommunityChannels)
  .post(createChannel);

router.route('/:id/channels/:channelId')
  .put(updateChannel)
  .delete(deleteChannel);

router.route('/:id/join')
  .post(joinCommunity);

router.route('/:id/add-member')
  .post(addMember);

router.route('/:id/member-role')
  .put(updateMemberRole);

router.route('/:id/members/:memberId')
  .delete(kickMember);

router.route('/:id/decline-invite')
  .post(declineCommunityInvite);

router.route('/:id/notification-settings')
  .put(updateNotificationSettings);

router.post('/:id/server-profile', upload.single('avatar'), updateServerProfile);

module.exports = router;
