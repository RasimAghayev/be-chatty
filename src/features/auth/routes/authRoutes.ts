import { Password } from '@auth/controllers/password';
import { SignIn } from '@auth/controllers/signin';
import { Signout } from '@auth/controllers/signout';
import { SignUp } from '@auth/controllers/signup';
import { authLimiter } from '@global/helpers/rate-limiter';
import express, { Router } from 'express';

class AuthRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    // CodeQL js/missing-rate-limiting: signup/signin/forgot-password/
    // reset-password are brute-force / credential-stuffing / account-
    // enumeration targets, so they get the stricter limiter on top of the
    // app-wide one in setupServer.ts.
    this.router.post('/signup', authLimiter, SignUp.prototype.create);
    this.router.post('/signin', authLimiter, SignIn.prototype.read);
    this.router.post('/forgot-password', authLimiter, Password.prototype.create);
    this.router.post('/reset-password/:token', authLimiter, Password.prototype.update);
    return this.router;
  }

  public signOutRouter(): Router {
    this.router.get('/signout', Signout.prototype.update);
    return this.router;
  }
}

export const authRoutes: AuthRoutes = new AuthRoutes();
