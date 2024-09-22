import { Job, DoneCallback } from 'bull';
import { authWorker } from '@worker/authWorker';
import { authService } from '@service/db/auth.service';
import Logger from 'bunyan';

jest.mock('@service/db/auth.service');
jest.mock('bunyan');

describe('AuthWorker', () => {
  let job: Job;
  let done: DoneCallback;

  beforeEach(() => {
    job = {
      data: { value: { username: 'testuser', email: 'testuser@example.com' } },
      progress: jest.fn(),
    } as unknown as Job;

    done = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should add user to DB and call done without error', async () => {
    // Mock authService.createAuthUser to resolve successfully
    (authService.createAuthUser as jest.Mock).mockResolvedValue(true);

    await authWorker.addAuthUserToDB(job, done);

    // Check if authService.createAuthUser was called with correct data
    expect(authService.createAuthUser).toHaveBeenCalledWith(job.data.value);

    // Check if job.progress was called with 100
    expect(job.progress).toHaveBeenCalledWith(100);

    // Check if done was called with null and job.data (indicating success)
    expect(done).toHaveBeenCalledWith(null, job.data);
  });

  it('should log error and call done with error on failure', async () => {
    const error = new Error('Failed to add user');
    // Mock authService.createAuthUser to throw an error
    (authService.createAuthUser as jest.Mock).mockRejectedValue(error);

    const logSpy = jest.spyOn(Logger.prototype, 'error');

    await authWorker.addAuthUserToDB(job, done);

    // Check if error was logged
    expect(logSpy).toHaveBeenCalledWith(error);

    // Check if done was called with the error
    expect(done).toHaveBeenCalledWith(error);
  });
});
