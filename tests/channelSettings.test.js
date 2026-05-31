const request = require('supertest');
const express = require('express');
const communityRoutes = require('../routes/communityRoutes');

jest.mock('../middleware/authMiddleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 'mockUserId' };
    next();
  }
}));

jest.mock('../controllers/CommunityController', () => ({
  updateChannel: (req, res) => {
    const { name, topic, slowMode, nsfw } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Channel name is required' });
    res.status(200).json({ 
      success: true, 
      data: { _id: req.params.channelId, name, topic, slowMode, nsfw } 
    });
  },
  deleteChannel: (req, res) => {
    res.status(200).json({ success: true, message: 'Channel deleted successfully' });
  }
}));

const app = express();
app.use(express.json());
app.use('/api/communities', communityRoutes);

describe('Channel Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/communities/:id/channels/:channelId', () => {
    it('should update channel settings correctly', async () => {
      const response = await request(app)
        .put('/api/communities/comm123/channels/chan123')
        .send({
          name: 'general-updated',
          topic: 'New Topic',
          slowMode: 10,
          nsfw: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('general-updated');
      expect(response.body.data.topic).toBe('New Topic');
      expect(response.body.data.slowMode).toBe(10);
      expect(response.body.data.nsfw).toBe(true);
    });

    it('should return 400 if name is empty', async () => {
      const response = await request(app)
        .put('/api/communities/comm123/channels/chan123')
        .send({ name: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/communities/:id/channels/:channelId', () => {
    it('should delete channel correctly', async () => {
      const response = await request(app).delete('/api/communities/comm123/channels/chan123');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
