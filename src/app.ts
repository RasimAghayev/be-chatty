import express, { Express } from 'express';
import { ChattyServer } from '@root/setupServer';
import databaseConnection from '@root/setupDatabase';
import { config } from '@root/config';

export class Application {
  public initialize(): void {
    this.loadConfig();
    const app: Express = express();
    databaseConnection();
    const server: ChattyServer = new ChattyServer(app);
    server.start();
  }

  private loadConfig(): void {
    config.validateConfig();
    config.cloudinaryConfig();
  }
}

export const application: Application = new Application();
application.initialize();
