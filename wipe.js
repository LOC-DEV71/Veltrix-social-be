require('mongoose').connect('mongodb+srv://1945musictrending_db_user:5BwEF4InAubGaw6i@mongostudy.nhqvzsf.mongodb.net/veltrix_social').then(async () => {
  const User = require('./models/User');
  await User.updateMany({}, { $set: { ownedProfileEffects: [], activeProfileEffect: null, activeProfileEffectLayers: [] } });
  
  const Inventory = require('./models/Inventory');
  const invs = await Inventory.find({});
  for(let inv of invs) {
    inv.items = inv.items.filter(i => i.categorySlug !== 'hieu-ung-ho-so');
    await inv.save();
  }
  
  console.log('Wiped all user profile effects from Users and Inventories');
  process.exit(0);
}).catch(console.error);
