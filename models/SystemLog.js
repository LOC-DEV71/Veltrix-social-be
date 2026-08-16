const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ['INFO', 'WARN', 'ERROR'],
    },
    message: {
      type: String,
      required: true,
    },
    
    timeString: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // auto-delete after 7 days
    },
  }
);

module.exports = mongoose.model('SystemLog', systemLogSchema);
