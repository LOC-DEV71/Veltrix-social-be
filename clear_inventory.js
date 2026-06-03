const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const userId = '6a13bd953698beecd1455381';
  await User.updateOne({ _id: userId }, {
    $set: {
      ownedFrames: [],
      ownedNameplates: [],
      ownedProfileEffects: [],
      activeFrame: null,
      activeFrameStaticUrl: null,
      activeFrameAnimatedUrl: null,
      activeNameplate: null,
      activeNameplateStaticUrl: null,
      activeNameplateAnimatedUrl: null,
      activeProfileEffect: null,
      activeProfileEffectStaticUrl: null,
      activeProfileEffectAnimatedUrl: null,
      activeProfileEffectLayers: []
    }
  });
  console.log('Successfully cleared inventory and active effects for user ' + userId);
  process.exit(0);
}).catch(console.error);
