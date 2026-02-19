import app from './app.js';
import { connectToDatabase } from './config/db.js';
import { env } from './config/env.js';

const startServer = async (): Promise<void> => {
  await connectToDatabase();

  app.listen(env.port, () => {
    console.log(`Server Commands API listening on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start API service:', error);
  process.exit(1);
});
