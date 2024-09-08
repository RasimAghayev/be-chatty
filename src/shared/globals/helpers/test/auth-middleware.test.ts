import { Request, Response, NextFunction } from 'express';
import JWT from 'jsonwebtoken';
import { AuthMiddleware } from '@global/helpers/auth-middleware';
import { NotAuthorizedError } from '@global/helpers/error-handler';
import { config } from '@root/config';
import { AuthPayload } from '@auth/interfaces/auth.interface';

jest.mock('jsonwebtoken');
jest.mock('@root/config', () => ({
  config: {
    JWT_TOKEN: 'test-secret',
  },
}));

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    authMiddleware = new AuthMiddleware();
    mockRequest = {
      session: {},
      currentUser: undefined,
    };
    mockResponse = {};
    jest.clearAllMocks();
  });

  describe('verifyUser', () => {
    it('should throw NotAuthorizedError if JWT is not in session', () => {
      expect(() => {
        authMiddleware.verifyUser(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(NotAuthorizedError);
      expect(() => {
        authMiddleware.verifyUser(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow('Token not available. Please login again.');
    });

    it('should verify JWT and set currentUser if token is valid', () => {
      const mockPayload: AuthPayload = {
        uId: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatarColor: 'red',
        userId: '',
      };
      mockRequest.session = { jwt: 'valid-token' };
      (JWT.verify as jest.Mock).mockReturnValue(mockPayload);

      authMiddleware.verifyUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(JWT.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(mockRequest.currentUser).toEqual(mockPayload);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should throw NotAuthorizedError if JWT is invalid', () => {
      mockRequest.session = { jwt: 'invalid-token' };
      (JWT.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => {
        authMiddleware.verifyUser(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(NotAuthorizedError);
      expect(() => {
        authMiddleware.verifyUser(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow('Token is invalid. Please login again.');
    });
  });

  describe('checkAuthenticate', () => {
    it('should throw NotAuthorizedError if currentUser is not set', () => {
      expect(() => {
        authMiddleware.checkAuthenticate(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow(NotAuthorizedError);
      expect(() => {
        authMiddleware.checkAuthenticate(mockRequest as Request, mockResponse as Response, nextFunction);
      }).toThrow('Authentication is required to access this route');
    });

    it('should call next() if currentUser is set', () => {
      mockRequest.currentUser = {
        userId: '123',
        uId: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatarColor: 'red',
      };

      authMiddleware.checkAuthenticate(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
