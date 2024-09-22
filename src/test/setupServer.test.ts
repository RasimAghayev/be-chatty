import { Application } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import Logger from 'bunyan';
import { config } from '@root/config';
import { ChattyServer } from '@root/setupServer';
import { server } from 'typescript';

// Mocks
jest.mock('http');
jest.mock('express');
jest.mock('socket.io');
jest.mock('redis');
jest.mock('@socket.io/redis-adapter');
jest.mock('bunyan');
jest.mock('@root/routes');

// Create mock implementations
const mockListen = jest.fn();
const mockCreateServer = jest.fn().mockReturnValue({
  listen: mockListen,
} as any);

const mockSocketIO = {} as Server;
const mockCreateSocketIO = jest.fn().mockResolvedValue(mockSocketIO);

const mockCreateClient = jest.fn().mockReturnValue({
  connect: jest.fn().mockResolvedValue(undefined),
  duplicate: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(undefined),
  }),
});

const mockCreateAdapter = jest.fn();

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

(http.createServer as jest.Mock) = mockCreateServer;
(Server as unknown as jest.Mock) = jest.fn().mockReturnValue(mockSocketIO);
(createClient as jest.Mock) = mockCreateClient;
(createAdapter as jest.Mock) = mockCreateAdapter;
(config.createLogger as jest.Mock) = jest.fn().mockReturnValue(mockLog);

describe('ChattyServer', () => {
  let app: Application;
  let chattyServer: ChattyServer;

  beforeEach(() => {
    jest.clearAllMocks();
    app = {} as Application;
    chattyServer = new ChattyServer(app);
  });

  it('should start the server and setup socket.io', async () => {
    await chattyServer.start();

    expect(mockCreateServer).toHaveBeenCalledWith(app);
    expect(mockCreateSocketIO).toHaveBeenCalledWith(mockCreateServer());
    expect(mockListen).toHaveBeenCalledWith(config.SERVER_PORT, expect.any(Function));
    expect(mockLog.info).toHaveBeenCalledWith(`Server is running on port ${config.SERVER_PORT}`);
  });

  it('should setup socket.io connections', async () => {
    const mockHttpServer: http.Server = {} as http.Server;
    const mockSocketIO = {
      adapter: jest.fn(),
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockSocketIO);

    await (server as any)['createSocketIO'](mockHttpServer);

    expect(Server).toHaveBeenCalledWith(mockHttpServer, expect.any(Object));
    expect(mockSocketIO.adapter).toHaveBeenCalled();
  });

  it('should handle errors during server start', async () => {
    const mockError = new Error('Server start error');
    mockCreateSocketIO.mockRejectedValueOnce(mockError);
    await chattyServer.start();

    expect(mockLog.error).toHaveBeenCalledWith(mockError);
  });
});
