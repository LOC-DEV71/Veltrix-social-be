const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const User = require('./models/User');
const Inventory = require('./models/Inventory');

const deleteId = '6a1448d64da0d23c30c39bd3';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const objId = new mongoose.Types.ObjectId(deleteId);

    // Check Inventory
    const invRes = await Inventory.updateMany(
      { 'items.product': objId },
      { $pull: { items: { product: objId } } }
    );
    console.log(`Updated inventories with objId: ${invRes.modifiedCount}`);

    // Check User
    const userRes = await User.updateMany(
      { 
        $or: [
          { ownedFrames: objId },
          { ownedNameplates: objId }
        ]
      },
      { 
        $pull: { 
          ownedFrames: objId,
          ownedNameplates: objId
        }
      }
    );
    console.log(`Updated users owned with objId: ${userRes.modifiedCount}`);

    // Find any users that still have string version
    const userResStr = await User.updateMany(
      { 
        $or: [
          { ownedFrames: deleteId },
          { ownedNameplates: deleteId }
        ]
      },
      { 
        $pull: { 
          ownedFrames: deleteId,
          ownedNameplates: deleteId
        }
      }
    );
    console.log(`Updated users owned with string: ${userResStr.modifiedCount}`);
    
    // Also let's check what's in the DB for the user "Doraemon" or any user with null products in inventory
    const badInvs = await Inventory.find().populate('items.product');
    let badCount = 0;
    for (const inv of badInvs) {
      const originalLen = inv.items.length;
      inv.items = inv.items.filter(item => item.product != null);
      if (inv.items.length !== originalLen) {
        await inv.save();
        badCount++;
      }
    }
    console.log(`Cleaned up ${badCount} inventories with null products.`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
