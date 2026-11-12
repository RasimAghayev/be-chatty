import express, { Express } from 'express';
import { ChattyServer } from '@root/setupServer';
import databaseConnection from '@root/setupDatabase';
import { config } from '@root/config';

export class Application {
  public async initialize(): Promise<void> {
    try {
      this.loadConfig();
      const app: Express = express();
      await databaseConnection(); // Ensure this is async if it returns a Promise
      const server: ChattyServer = new ChattyServer(app);
      await server.start(); // Ensure this is async if it returns a Promise
    } catch (error) {
      console.error('Failed to initialize the application:', error);
      process.exit(1); // Exit with an error code
    }
  }

  private loadConfig(): void {
    config.validateConfig();
    config.cloudinaryConfig();
  }
}

export const application: Application = new Application();
application.initialize();
