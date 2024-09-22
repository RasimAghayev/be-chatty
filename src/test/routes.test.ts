import routes from '@root/routes';
import express from 'express';
import request from 'supertest';

describe('API Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    routes(app);
  });

  it('should respond to a GET request at /queues', async () => {
    const response = await request(app).get('/queues'); // Replace with actual endpoint
    expect(response.status).toBe(200); // Adjust based on expected status
    // Add more assertions based on the response
  });

  it('should respond to a GET request at /api/v1/signout', async () => {
    const response = await request(app).get('/api/v1/signout'); // Replace with actual endpoint
    expect(response.status).toBe(200); // Adjust based on expected status
    // Add more assertions based on the response
  });

  // Add more tests as needed
});
