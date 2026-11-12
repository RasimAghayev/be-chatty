import { Job, DoneCallback } from 'bull';
import { mailTransport } from '@service/emails/mail.transport';
import { emailWorker } from '@worker/email.worker';

jest.mock('@service/emails/mail.transport');
jest.mock('@root/config', () => ({
  config: {
    createLogger: jest.fn().mockReturnValue({
      error: jest.fn(),
      info: jest.fn(),
    }),
  },
}));
jest.mock('bunyan');

describe('EmailWorker', () => {
  let job: Job;
  let done: DoneCallback;

  beforeEach(() => {
    job = {
      data: {
        template: '<p>hello</p>',
        receiverEmail: 'user@example.com',
        subject: 'Test subject',
      },
      progress: jest.fn(),
    } as unknown as Job;

    done = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('TC_WORKER_EMAIL_SUCCESS_001 sends email and marks job done', async () => {
    (mailTransport.sendEmail as jest.Mock).mockResolvedValue(undefined);

    await emailWorker.addNotificationEmail(job, done);

    expect(mailTransport.sendEmail).toHaveBeenCalledWith('user@example.com', 'Test subject', '<p>hello</p>');
    expect(job.progress).toHaveBeenCalledWith(100);
    expect(done).toHaveBeenCalledWith(null, job.data);
  });

  it('TC_WORKER_EMAIL_FAILURE_002 propagates transport errors', async () => {
    const error = new Error('send failed');
    (mailTransport.sendEmail as jest.Mock).mockRejectedValue(error);

    await emailWorker.addNotificationEmail(job, done);

    expect(done).toHaveBeenCalledWith(error);
  });
});
