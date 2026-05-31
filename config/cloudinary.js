const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cấu hình Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine the folder based on the file field name
    let folderName = 'vetrix_products';
    if (file.fieldname === 'staticImage') {
      folderName = 'vetrix_products/static';
    } else if (file.fieldname === 'animatedImage') {
      folderName = 'vetrix_products/animated';
    } else if (file.fieldname === 'attachment' || file.fieldname === 'attachments') {
      folderName = 'vetrix_chat_attachments';
    }

    return {
      folder: folderName,
      resource_type: 'auto', // Tự động nhận diện image/video(gif)
    };
  },
});

const upload = multer({ storage: storage });

module.exports = {
  cloudinary,
  upload
};
