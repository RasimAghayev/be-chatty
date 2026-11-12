import { Application } from '@root/app';
import databaseConnection from '@root/setupDatabase';
import { ChattyServer } from '@root/setupServer';
import { config } from '@root/config';

// Mock the dependencies
jest.mock('@root/setupDatabase', () => jest.fn().mockResolvedValue(true));
jest.mock('@root/setupServer', () => ({
  ChattyServer: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(true),
  })),
}));
jest.mock('@root/config', () => ({
  config: {
    validateConfig: jest.fn(),
    cloudinaryConfig: jest.fn(),
  },
}));

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
  });

  it('TC_APP_BOOTSTRAP_001 initializes config, database, and server', async () => {
    await app.initialize();

    expect(config.validateConfig).toHaveBeenCalled();
    expect(config.cloudinaryConfig).toHaveBeenCalled();
    expect(databaseConnection).toHaveBeenCalled();
    expect(ChattyServer).toHaveBeenCalledTimes(1);
    const serverInstance = (ChattyServer as jest.Mock).mock.results[0].value;
    expect(serverInstance.start).toHaveBeenCalled();
  });

  // it('should handle database connection errors', async () => {
  //   // Set up database connection to throw an error
  //   (databaseConnection as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

  //   await expect(app.initialize()).rejects.toThrow('Database connection failed');
  // });

  // it('should handle server start errors', async () => {
  //   // Set up ChattyServer to throw an error on start
  //   (ChattyServer.prototype.start as jest.Mock).mockRejectedValue(new Error('Server start failed'));

  //   await expect(app.initialize()).rejects.toThrow('Server start failed');
  // });

  // it('should handle configuration errors', () => {
  //   // Set up validateConfig to throw an error
  //   (config.validateConfig as jest.Mock).mockImplementation(() => {
  //     throw new Error('Configuration validation failed');
  //   });

  //   expect(() => app.initialize()).toThrow('Configuration validation failed');
  // });
});
