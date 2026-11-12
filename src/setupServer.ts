import { Application, Request, Response, json, urlencoded, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cookieSession from 'cookie-session';
import HTTP_STATUS from 'http-status-codes';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import Logger from 'bunyan';
import { config } from '@root/config';
import applicationRoutes from '@root/routes';
import { CustomError, IErrorResponse } from '@global/helpers/error-handler';
import { apiLimiter } from '@global/helpers/rate-limiter';

const log: Logger = config.createLogger('setupServer');
export class ChattyServer {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public start(): void {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routesMiddleware(this.app);
    this.globalErrorHandler(this.app);
    this.startServer(this.app);
  }

  private securityMiddleware(app: Application): void {
    app.disable('x-powered-by');
    app.use(
      cookieSession({
        name: 'session',
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        maxAge: 7 * 24 * 3600000, // 7 days
        secure: config.NODE_ENV !== 'development',
        httpOnly: true,
        sameSite: 'lax',
      })
    );
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        // CodeQL js/cors-permissive-configuration: always resolve to the
        // explicit, env-configured frontend origin (CLIENT_URL, already used
        // throughout this app, e.g. for password-reset links) instead of a
        // `*` wildcard in development. CLIENT_URL already defaults to
        // 'http://localhost:3000' (see src/config.ts / .env.example), which
        // is the same origin a local frontend dev server used, so this is
        // not a behavior change for the documented local-dev setup.
        origin: config.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: HTTP_STATUS.OK,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      })
    );
  }

  private standardMiddleware(app: Application): void {
    app.use(compression());
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    // CodeQL js/missing-rate-limiting: app-wide baseline limiter ahead of
    // routesMiddleware(); the auth feature additionally layers a stricter,
    // endpoint-specific limiter (see authRoutes.ts).
    app.use(apiLimiter);
  }

  private routesMiddleware(app: Application): void {
    applicationRoutes(app);
  }

  private globalErrorHandler(app: Application): void {
    app.use((req: Request, res: Response) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({ message: `Route ${req.originalUrl} not found` });
    });

    app.use((error: IErrorResponse, _req: Request, res: Response, next: NextFunction) => {
      log.error(error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).send(error.serializeErrors());
      }
      if (res.headersSent) {
        return next(error);
      }
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    });
  }

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServer: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServer);
      this.startHttpServer(httpServer);
      this.socketIOConnections(socketIO);
    } catch (error) {
      log.error(error);
    }
  }

  private async createSocketIO(httpServer: http.Server): Promise<Server> {
    const io: Server = new Server(httpServer, {
      cors: {
        // Same fix as the Express CORS config above (CodeQL
        // js/cors-permissive-configuration): no `*` wildcard, always the
        // configured CLIENT_URL.
        origin: config.CLIENT_URL,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      },
    });
    const pubClient = createClient({ url: config.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return io;
  }

  private getCircularReplacer() {
    const seen = new WeakSet();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON.stringify's replacer signature requires `value: any`
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return; // Discard the circular reference
        }
        seen.add(value);
      }
      return value;
    };
  }
  private socketIOConnections(io: Server): void {
    log.info(`SocketIOConnections ${JSON.stringify(io, this.getCircularReplacer())}`);
  }
  private startHttpServer(httpServer: http.Server): void {
    log.info(`Server has started with process id: ${process.pid}`);
    httpServer.listen(config.SERVER_PORT, () => {
      log.info(`Server is running on port ${config.SERVER_PORT}`);
    });
  }
}
