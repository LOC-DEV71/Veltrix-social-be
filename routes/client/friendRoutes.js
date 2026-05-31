const express = require('express');
const router = express.Router();
const friendController = require('../../controllers/client/friendController');
const { verifyToken } = require('../../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', friendController.getFriendsData);
router.post('/request', friendController.sendFriendRequest);
router.post('/accept', friendController.acceptFriendRequest);
router.post('/decline', friendController.declineFriendRequest);
router.delete('/remove/:targetId', friendController.removeFriend);

module.exports = router;
