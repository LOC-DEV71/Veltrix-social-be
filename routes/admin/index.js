const express = require('express');
const router = express.Router();

// Import middlewares
const { verifyToken, isAdmin } = require('../../middleware/authMiddleware');

// Import individual route files
const adminAuthRoutes = require('./adminAuthRoutes');
const accountRoutes = require('./accountRoutes');
const roleRoutes = require('./roleRoutes');
const permissionRoutes = require('./permissionRoutes');
const categoryRoutes = require('./categoryRoutes');

// No legacy controllers needed anymore

// 🔴 Administrative Auth Routes (handles login, logout, me internally)
router.use('/auth', adminAuthRoutes);

const SystemLog = require('../../models/SystemLog');

// 🔒 Protected Administrative CRUD Routes
router.use('/accounts', accountRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', require('./productRoutes'));
router.use('/users', require('./userRoutes'));

// 📊 Dashboard Stats Route
const User = require('../../models/User');
const Product = require('../../models/Product');

router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    const premiumCount = await User.countDocuments({ isPremium: true });
    const framesCount = await Product.countDocuments();
    const users = await User.find({}, 'coins');
    const totalCoins = users.reduce((acc, user) => acc + (user.coins || 0), 0);

    let webSocketConnections = 0;
    let webRtcSessions = 0;
      try {
        const { getIO } = require('../../socket.js');
        const io = getIO();
        const totalSockets = (io.engine && io.engine.clientsCount) || (io.sockets && io.sockets.sockets.size) || 0;
        const adminSockets = io.sockets.adapter.rooms?.get('admin_room')?.size || 0;
        webSocketConnections = Math.max(0, totalSockets - adminSockets);
        if (io.voiceChannels) {
          webRtcSessions = Object.values(io.voiceChannels).reduce((acc, curr) => acc + curr.length, 0) || 0;
        }
      } catch (err) {
        console.warn('Could not fetch socket metrics for stats');
      }

    // 📈 Calculate True Rolling 24h Traffic Data (Messages per 4-hour block)
    const Message = require('../../models/Message');
    const now = new Date();
    const startOf24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const trafficAggr = await Message.aggregate([
      { $match: { createdAt: { $gte: startOf24h } } },
      {
        $group: {
          _id: {
            // Group by 4 hour blocks based on the local UTC hour
            $subtract: [ { $hour: "$createdAt" }, { $mod: [{ $hour: "$createdAt" }, 4] } ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const realTraffic = {};
    trafficAggr.forEach(item => {
      realTraffic[item._id] = item.count;
    });

    // Build rolling 24h buckets starting from 24h ago to now
    const trafficData = [];
    const currentHour = now.getUTCHours();
    let currentBucket = currentHour - (currentHour % 4);
    
    // We want 6 buckets (24 hours / 4 = 6 buckets)
    for (let i = 5; i >= 0; i--) {
      let b = currentBucket - (i * 4);
      if (b < 0) b += 24;
      
      const timeStr = b.toString().padStart(2, '0') + ':00';
      trafficData.push({
        time: timeStr,
        traffic: realTraffic[b] || 0
      });
    }

    res.json({
      success: true,
      data: {
        usersCount,
        premiumCount,
        framesCount,
        totalCoins,
        webSocketConnections,
        webRtcSessions,
        trafficData
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// 📊 Telemetry Logs Route
router.get('/logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const logs = await SystemLog.find().sort({ createdAt: -1 }).limit(50);
    // Reverse so the newest is at the top of the array but we render them bottom-up or map them
    // Actually our UI maps them in order, so we return them sorted desc
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
