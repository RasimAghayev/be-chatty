import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from 'express';

export class Signout {
  public async udpate(req: Request, res: Response): Promise<void> {
    req.session = null;
    res.status(HTTP_STATUS.OK).json({ message: 'User has been signed out', user: {}, token: '' });
  }
}
