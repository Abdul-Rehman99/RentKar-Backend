// src/config/database.ts
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);

    const connection = mongoose.connection;

    connection.on('connected', () => {
      console.log('MongoDB connected');
    });

    connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
      process.exit(1);
    });
  } catch (err) {
    console.error('Database connection failed', err);
    process.exit(1);
  }
};

export default connectDB;
