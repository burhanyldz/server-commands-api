import mongoose from 'mongoose';
import { env } from './env.js';

export const connectToDatabase = async (): Promise<void> => {
  await mongoose.connect(env.mongoUri, {
    dbName: env.mongoDbName
  });
};
