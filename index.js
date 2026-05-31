const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./config/db');
const { initSocket } = require('./socket');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io initialization with custom handler file
initSocket(server);

// Middleware
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Health Route
app.get('/', (req, res) => {
  res.json({ 
    status: 'success',
    message: 'Vetrix real-time server API is running successfully! 🚀' 
  });
});

// API Routes Mounting
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/messageRoutes');
const communityRoutes = require('./routes/communityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔴 Global Error:', err.message, err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Start Server listening
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🟢 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
