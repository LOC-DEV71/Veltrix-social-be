const BannedIP = require('../models/BannedIP');

// In-memory rate limiting requests tracker
const ipRequestTracker = {};

// Clean up RAM data occasionally to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const ip in ipRequestTracker) {
    // Keep only requests made within the last 3 seconds
    ipRequestTracker[ip] = ipRequestTracker[ip].filter(timestamp => now - timestamp < 3000);
    if (ipRequestTracker[ip].length === 0) {
      delete ipRequestTracker[ip];
    }
  }
}, 10000); // Trigger cleanup every 10 seconds

const antiSpam = async (req, res, next) => {
  try {
    // Get client IP address
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // 1. If IP already exists in BannedIP collection, block immediately (status 403)
    const isBanned = await BannedIP.findOne({ ip: clientIp });
    if (isBanned) {
      return res.status(403).json({
        status: 'error',
        message: 'Truy cập bị từ chối! Địa chỉ IP của bạn đã bị cấm vĩnh viễn khỏi hệ thống do hành vi Spam!'
      });
    }

    // 2. Log request timestamp in RAM
    const now = Date.now();
    if (!ipRequestTracker[clientIp]) {
      ipRequestTracker[clientIp] = [];
    }

    ipRequestTracker[clientIp].push(now);

    // Keep only timestamps within last 3 seconds
    ipRequestTracker[clientIp] = ipRequestTracker[clientIp].filter(timestamp => now - timestamp < 3000);

    // 3. If requests exceed 10 inside 3 seconds, Ban the IP and return 429
    if (ipRequestTracker[clientIp].length > 10) {
      console.warn(`🚨 AntiSpam: Rate limit exceeded for IP ${clientIp}. Adding to blacklist...`);

      // Save IP to BannedIP database
      await BannedIP.findOneAndUpdate(
        { ip: clientIp },
        { 
          ip: clientIp, 
          reason: 'Spam requests detected (Gửi hơn 10 requests trong vòng 3 giây)' 
        },
        { upsert: true, new: true }
      );

      return res.status(429).json({
        status: 'error',
        message: 'Cảnh báo: Hành vi spam bị nghiêm cấm! IP của bạn đã bị khóa.'
      });
    }

    next();
  } catch (error) {
    console.error(`🔴 AntiSpam Middleware Error: ${error.message}`);
    next();
  }
};

module.exports = antiSpam;
