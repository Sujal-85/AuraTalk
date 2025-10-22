// fix-missing-public-keys.js
import mongoose from 'mongoose';
import User from './src/models/user.model.js';
import crypto from 'crypto';

async function fixUsers() {
  await mongoose.connect('mongodb://localhost:27017/YOUR_DB_NAME'); // Change to your DB
  const users = await User.find({ $or: [{ publicKey: { $exists: false } }, { publicKey: null }] });
  for (const user of users) {
    const { publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'jwk' },
      privateKeyEncoding: { type: 'pkcs8', format: 'jwk' }
    });
    user.publicKey = publicKey;
    await user.save();
    console.log(`Fixed user: ${user.email || user._id}`);
  }
  mongoose.disconnect();
}
await fixUsers(); 