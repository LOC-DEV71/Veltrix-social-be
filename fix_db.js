const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb+srv://1945musictrending_db_user:5BwEF4InAubGaw6i@mongostudy.nhqvzsf.mongodb.net/veltrix_social?retryWrites=true&w=majority')
  .then(async () => {
    try {
      const res = await User.updateOne({ email: 'loc@gmail.com' }, { $set: { role: 'admin' } });
      console.log('Update result:', res);
    } catch (e) {
      console.error(e);
    } finally {
      mongoose.disconnect();
    }
  });
