const request = require('supertest');
const express = require('express');
const communityRoutes = require('../routes/communityRoutes');
const { verifyToken } = require('../middleware/authMiddleware');

// Mock auth middleware to always pass
jest.mock('../middleware/authMiddleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 'mockUserId' };
    next();
  }
}));

// Mock the controller so we don't need real DB
jest.mock('../controllers/CommunityController', () => ({
  updateCommunity: (req, res) => {
    const { name, serverTag } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Community name is required' });
    res.status(200).json({ success: true, data: { _id: req.params.id, name, serverTag } });
  },
  deleteCommunity: (req, res) => {
    res.status(200).json({ success: true, message: 'Community deleted successfully' });
  },
  kickMember: (req, res) => {
    res.status(200).json({ success: true, message: 'Member kicked' });
  }
}));

const app = express();
app.use(express.json());
app.use('/api/communities', communityRoutes);

describe('Community Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/communities/:id', () => {
    it('should update community profile successfully', async () => {
      const response = await request(app)
        .put('/api/communities/communityId123')
        .send({
          name: 'New Community Name',
          serverTag: 'TEST'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Community Name');
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .put('/api/communities/communityId123')
        .send({
          serverTag: 'TEST'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/communities/:id', () => {
    it('should delete the community', async () => {
      const response = await request(app).delete('/api/communities/communityId123');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/communities/:id/members/:memberId', () => {
    it('should kick a member', async () => {
      const response = await request(app).delete('/api/communities/communityId123/members/memberId123');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
