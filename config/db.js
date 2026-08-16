const mongoose = require('mongoose');


const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vetrix');
    console.log(`🟢 MongoDB Connected: ${conn.connection.host}`);
    

  } catch (error) {
    console.error(`🔴 MongoDB Connection Error: ${error.message}`);
    console.warn(`⚠️ Warning: Server is running without active database connection. Please check MONGO_URI in .env!`);
  }
};


module.exports = connectDB;



