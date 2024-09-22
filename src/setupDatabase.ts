import mongoose from 'mongoose';
import Logger from 'bunyan';
import { config } from '@root/config';
import { redisConnection } from '@service/redis/redis.connection';

const log: Logger = config.createLogger('setupDatabase');

export default async function setupDatabase(): Promise<void> {
  const connect = async () => {
    try {
      await mongoose.connect(`${config.DATABASE_URL}`);
      log.info('Database connected successfully');

      // Connect to Redis
      await redisConnection.connect();
    } catch (error) {
      log.error('Database connection failed. Exiting now...', error);
      process.exit(1); // Exit with an error code if connection fails
    }
  };

  // Initial connection
  await connect();

  // Handle disconnection and retry
  mongoose.connection.on('disconnected', async () => {
    log.warn('Database disconnected. Attempting to reconnect...');
    await connect();
  });

  // Optional: Handle SIGINT and SIGTERM signals to close connections gracefully
  process.on('SIGINT', async () => {
    log.info('SIGINT signal received: closing database connection');
    await mongoose.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log.info('SIGTERM signal received: closing database connection');
    await mongoose.disconnect();
    process.exit(0);
  });
}
