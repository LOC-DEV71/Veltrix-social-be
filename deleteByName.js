const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const PremiumProduct = require('./models/PremiumProduct');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Find all products with name "Doraemon" or name containing "test"
    const badProducts = await Product.find({
      $or: [
        { name: /test/i },
        { description: /test/i },
        { name: /Doraemon/i }
      ]
    });

    console.log(`Found ${badProducts.length} bad products`);
    for (const p of badProducts) {
      console.log(`- ${p.name} (${p._id})`);
      
      const pId = p._id;

      await Product.deleteOne({ _id: pId });
      await PremiumProduct.deleteMany({ product: pId });

      await Inventory.updateMany(
        { 'items.product': pId },
        { $pull: { items: { product: pId } } }
      );

      await User.updateMany(
        { 
          $or: [
            { ownedFrames: pId },
            { ownedNameplates: pId }
          ]
        },
        { 
          $pull: { 
            ownedFrames: pId,
            ownedNameplates: pId
          }
        }
      );

      await User.updateMany(
        { $or: [{ activeFrame: pId }, { activeNameplate: pId }] },
        {
          $unset: {
            activeFrame: "",
            activeFrameStaticUrl: "",
            activeFrameAnimatedUrl: "",
            activeNameplate: "",
            activeNameplateStaticUrl: "",
            activeNameplateAnimatedUrl: ""
          }
        }
      );
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
