import mongoose from "mongoose";

export const connectDB = async () => {
try{
   console.log('Connecting to MongoDB...');
   const conn = await mongoose.connect(process.env.MONGODB_URI);
   console.log(`MongoDB Connected: ${conn.connection.host}`);
} catch(error){
   console.error('Error connecting to MongoDB:', error.message);
   process.exit(1);
}
};