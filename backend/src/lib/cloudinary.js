import {v2 as cloudinary} from "cloudinary"

import {config} from 'dotenv'

config()

// Configure Cloudinary only if credentials are available
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('Cloudinary service initialized successfully');
} else {
  console.log('Cloudinary service not configured - image upload features will be disabled');
}

export default cloudinary;
