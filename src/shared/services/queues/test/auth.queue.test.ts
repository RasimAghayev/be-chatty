import { authWorker } from '@worker/auth.worker';
import { IAuthJob } from '@auth/interfaces/auth.interface';
import { BaseQueue } from '../base.queue';
import { authQueue, AuthQueue } from '../auth.queue';
// Mock the worker methods
jest.mock('@worker/auth.worker', () => ({
  authWorker: {
    addAuthUserToDB: jest.fn(),
  },
}));

describe('AuthQueue', () => {
  let baseQueuePrototype: any;

  beforeAll(() => {
    // Create a prototype reference for spying
    baseQueuePrototype = BaseQueue.prototype;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call addJob with the correct parameters when addAuthUserJob is called', () => {
    const addJobSpy = jest.spyOn(baseQueuePrototype, 'addJob');
    const jobData: IAuthJob = { value: 'mockUser' };

    authQueue.addAuthUserJob('addAuthUserToDB', jobData);

    expect(addJobSpy).toHaveBeenCalledWith('addAuthUserToDB', jobData);
  });

  it('should process addAuthUserToDB jobs with the authWorker', () => {
    const processJobSpy = jest.spyOn(baseQueuePrototype, 'processJob');

    // Initialize a new instance of AuthQueue to trigger processJob
    const newAuthQueue = new AuthQueue();

    expect(processJobSpy).toHaveBeenCalledWith('addAuthUserToDB', 5, authWorker.addAuthUserToDB);
  });
});
