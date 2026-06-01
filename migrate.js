const mongoose = require('mongoose');
const PremiumPerk = require('./models/PremiumPerk');

mongoose.connect('mongodb+srv://1945musictrending_db_user:5BwEF4InAubGaw6i@mongostudy.nhqvzsf.mongodb.net/veltrix_social?retryWrites=true&w=majority')
  .then(async () => {
    const db = mongoose.connection.db;
    const products = await db.collection('products').find({ isPremium: true }).toArray();
    
    for (const p of products) {
      await PremiumPerk.findOneAndUpdate(
        { product: p._id },
        { endDate: p.premiumEndDate || null },
        { upsert: true }
      );
      await db.collection('products').updateOne(
        { _id: p._id },
        { $unset: { isPremium: "", premiumEndDate: "" } }
      );
    }
    
    console.log(`Migrated ${products.length} products.`);
    process.exit(0);
  });
