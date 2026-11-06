import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';

/**
 * Template Method for Bull job processors: every worker in this repo
 * (auth, email, user) implemented the exact same
 * try/await-the-real-work/job.progress(100)/done(null, job.data) /
 * catch/log.error/done(error) shape independently (DRY, Phase 8
 * architecture pass; see docs/adr/0002-dry-worker-template-method.md).
 * This mirrors the BaseQueue/BaseCache abstract-base convention already
 * used elsewhere in this repo (shared/services/queues/base.queue.ts,
 * shared/services/redis/base.cache.ts) rather than introducing a new
 * pattern.
 */
export abstract class BaseWorker {
  protected log: Logger;

  constructor(workerName: string) {
    this.log = config.createLogger(workerName);
  }

  protected async run(job: Job, done: DoneCallback, task: (data: Job['data']) => Promise<void>): Promise<void> {
    try {
      await task(job.data);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      this.log.error(error);
      done(error as Error);
    }
  }
}
