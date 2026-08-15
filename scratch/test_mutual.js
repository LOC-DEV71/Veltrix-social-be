const mongoose = require('mongoose');
const uri = 'mongodb+srv://1945musictrending_db_user:5BwEF4InAubGaw6i@mongostudy.nhqvzsf.mongodb.net/veltrix_social?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
  const User = require('../models/User');
  const Community = require('../models/Community');
  
  const u1 = await User.findOne({ username: 'MiyznKry' });
  const u2 = await User.findOne({ $or: [{ username: /demon/i }, { displayName: /demon/i }] });
  
  console.log('User 1 (MiyznKry):', u1?._id, u1?.username);
  console.log('User 2 (Demon):', u2?._id, u2?.username);
  
  if (u1 && u2) {
    const comms = await Community.find({
      'members.user': { $all: [u1._id, u2._id] }
    }).select('_id name icon');
    
    console.log('Mutual communities found count:', comms.length);
    console.log('Mutual communities:', comms);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
