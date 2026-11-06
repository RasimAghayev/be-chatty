import { DoneCallback, Job } from 'bull';
import { mailTransport } from '@service/emails/mail.transport';
import { BaseWorker } from './base.worker';

class EmailWorker extends BaseWorker {
  constructor() {
    super('emailWorker');
  }

  // Arrow class property: see auth.worker.ts for why (registered unbound
  // as a Bull process callback via email.queue.ts).
  addNotificationEmail = async (job: Job, done: DoneCallback): Promise<void> => {
    await this.run(job, done, async ({ template, receiverEmail, subject }) => {
      await mailTransport.sendEmail(receiverEmail, subject, template);
    });
  };
}

export const emailWorker: EmailWorker = new EmailWorker();
