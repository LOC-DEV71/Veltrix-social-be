const mongoose = require('mongoose');
const uri = 'mongodb+srv://1945musictrending_db_user:5BwEF4InAubGaw6i@mongostudy.nhqvzsf.mongodb.net/veltrix_social';
const User = require('c:/Vetrix/backend/models/User');

mongoose.connect(uri).then(async () => {
  const users = await User.find({ username: { $in: ['demon', 'Demon', 'miyznkry', 'MiyznKry'] } })
    .populate('activeFrame')
    .populate('activeNameplate')
    .populate('activeProfileEffect');
  
  users.forEach(u => {
    console.log('=== USER:', u.username, '===');
    console.log({
      displayName: u.displayName,
      bannerColor: u.bannerColor,
      bannerImage: u.bannerImage,
      themeColors: u.themeColors,
      activeFrame: u.activeFrame,
      activeFrameAnimatedUrl: u.activeFrameAnimatedUrl,
      activeNameplate: u.activeNameplate,
      activeNameplateAnimatedUrl: u.activeNameplateAnimatedUrl,
      activeProfileEffect: u.activeProfileEffect,
      activeProfileEffectAnimatedUrl: u.activeProfileEffectAnimatedUrl,
      activeProfileEffectStaticUrl: u.activeProfileEffectStaticUrl
    });
  });
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
