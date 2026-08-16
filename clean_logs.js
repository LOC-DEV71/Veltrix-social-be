const mongoose = require('mongoose');
const SystemLog = require('./models/SystemLog');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const count = await SystemLog.countDocuments();
  console.log('Current logs:', count);
  if (count > 20) {
    const logsToKeep = await SystemLog.find().sort({ createdAt: -1 }).limit(20).select('_id');
    const keepIds = logsToKeep.map(l => l._id);
    const res = await SystemLog.deleteMany({ _id: { $nin: keepIds } });
    console.log('Deleted:', res.deletedCount);
  }
  process.exit(0);
}).catch(console.error);

