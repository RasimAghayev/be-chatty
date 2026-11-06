import { DoneCallback, Job } from 'bull';
import { userService } from '@service/db/user.service';
import { BaseWorker } from './base.worker';

class UserWorker extends BaseWorker {
  constructor() {
    super('userWorker');
  }

  // Arrow class property: see auth.worker.ts for why (registered unbound
  // as a Bull process callback via user.queue.ts).
  addUserToDB = async (job: Job, done: DoneCallback): Promise<void> => {
    await this.run(job, done, async ({ value }) => {
      await userService.addUserData(value);
    });
  };
}

export const userWorker: UserWorker = new UserWorker();
