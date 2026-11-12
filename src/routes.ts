import { authRoutes } from '@auth/routes/authRoutes';
import { currentUserRoutes } from '@auth/routes/currentRoutes';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { serverAdapter } from '@service/queues/base.queue';
import { Application, Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

const BASE_PATH = '/api/v1';
export default (app: Application) => {
  const routes = () => {
    app.get('/health', (_req: Request, res: Response) => {
      res.status(HTTP_STATUS.OK).json({ status: 'ok' });
    });
    app.get('/health/live', (_req: Request, res: Response) => {
      res.status(HTTP_STATUS.OK).json({ status: 'live' });
    });
    app.get('/health/ready', (_req: Request, res: Response) => {
      res.status(HTTP_STATUS.OK).json({ status: 'ready' });
    });
    app.use('/queues', serverAdapter.getRouter());
    app.use(BASE_PATH, authRoutes.routes());
    app.use(BASE_PATH, authRoutes.signOutRouter());
    app.use(BASE_PATH, authMiddleware.verifyUser, currentUserRoutes.routes());
  };
  routes();
};
