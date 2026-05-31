const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getNotifications, markAsRead, markAllAsRead, markCommunityAsRead, markChannelAsRead } = require('../controllers/NotificationController');

router.use(verifyToken);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/read-community/:communityId', markCommunityAsRead);
router.put('/read-channel/:channelId', markChannelAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
