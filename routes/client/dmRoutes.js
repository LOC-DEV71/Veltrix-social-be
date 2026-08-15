const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/authMiddleware');
const {
  getOrCreateDMRoom,
  getUserDMRooms,
  getDMMessages,
  sendDirectMessage,
  toggleReaction
} = require('../../controllers/client/dmController');

router.use(verifyToken);

router.post('/get-or-create', getOrCreateDMRoom);
router.get('/rooms', getUserDMRooms);
router.get('/messages/:roomId', getDMMessages);
router.post('/messages/:roomId', sendDirectMessage);
router.post('/messages/:roomId/:msgId/reactions', toggleReaction);

module.exports = router;
