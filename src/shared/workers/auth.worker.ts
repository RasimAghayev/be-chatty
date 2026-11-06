import { DoneCallback, Job } from 'bull';
import { authService } from '@service/db/auth.service';
import { BaseWorker } from './base.worker';

class AuthWorker extends BaseWorker {
  constructor() {
    super('authWorker');
  }

  // Arrow class property (not a regular method): auth.queue.ts registers
  // this as a bare `authWorker.addAuthUserToDB` callback reference with no
  // `.bind()`, same as the controllers' `ClassName.prototype.method`
  // registration pattern in authRoutes.ts — `this` must already be bound
  // at construction time, which an arrow property does and a regular
  // method would not.
  addAuthUserToDB = async (job: Job, done: DoneCallback): Promise<void> => {
    await this.run(job, done, async ({ value }) => {
      await authService.createAuthUser(value);
    });
  };
}

export const authWorker: AuthWorker = new AuthWorker();
