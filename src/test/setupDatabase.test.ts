import mongoose from 'mongoose';
import Logger from 'bunyan';
import { config } from '@root/config';
import { redisConnection } from '@service/redis/redis.connection';
import setupDatabase from '@root/setupDatabase';

jest.mock('mongoose');
jest.mock('@service/redis/redis.connection');

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

(config as any).createLogger = jest.fn(() => mockLogger as any);

describe('setupDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to the database successfully and initialize Redis', async () => {
    (mongoose.connect as jest.Mock).mockResolvedValueOnce(true);
    (redisConnection.connect as jest.Mock).mockResolvedValueOnce(true);

    await setupDatabase();

    expect(mongoose.connect).toHaveBeenCalledWith(config.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    expect(redisConnection.connect).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Database connected successfully');
  });

  // it('should handle database connection failure', async () => {
  //   const error = new Error('Database connection failed');
  //   (mongoose.connect as jest.Mock).mockRejectedValueOnce(error);

  //   await expect(setupDatabase()).rejects.toThrow('Database connection failed');
  //   expect(mockLogger.error).toHaveBeenCalledWith('Database connection failed. Exiting now...', error);
  // });

  // it('should handle database reconnection on disconnection', async () => {
  //   (mongoose.connect as jest.Mock).mockResolvedValueOnce(true);
  //   (redisConnection.connect as jest.Mock).mockResolvedValueOnce(true);
  //   await setupDatabase();

  //   // Simulate disconnection
  //   (mongoose.connection.on as jest.Mock).mock.calls[0][1](); // Trigger the 'disconnected' event

  //   expect(mongoose.connect).toHaveBeenCalledTimes(2); // Initial and reconnection
  //   expect(mockLogger.warn).toHaveBeenCalledWith('Database disconnected. Attempting to reconnect...');
  // });

  // it('should handle graceful shutdown on SIGINT and SIGTERM', async () => {
  //   (mongoose.disconnect as jest.Mock).mockResolvedValueOnce(true);

  //   const originalExit = process.exit;

  //   process.exit = (code?: number): never => {
  //     // Your custom implementation here
  //     // You can call the original `process.exit` if needed
  //     originalExit(code);
  //     while (true) {}
  //   };

  //   // Restore original process.exit
  //   process.exit = originalExit;

  //   await setupDatabase();
  //   process.emit('SIGINT'); // Simulate SIGINT signal

  //   expect(mongoose.disconnect).toHaveBeenCalled();
  //   expect(process.exit).toHaveBeenCalledWith(0);

  //   process.exit = originalExit; // Restore original process.exit
  // });
});
