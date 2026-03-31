import dotenv from "dotenv";
dotenv.config();

const requiredEnvVars = [
  "MONGODB_URI",
  "JWT_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY"
];

export const validateEnv = () => {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    console.error("❌ CRITICAL ERROR: Missing required environment variables:");
    missing.forEach(m => console.error(`   - ${m}`));
    process.exit(1);
  }

  console.log("✅ Environment variables validated.");
};
