import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('Health Check | GET /health (Liveness Probe)', () => {
    it(
        'should return 200 OK with a message indicating the service is alive',
        async () => {
            // ARRANGE
            const app = createApp();

            // ACT
            const response = await request(app).get('/health');

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/json/);
            expect(response.body.status).toBe('OK');
            expect(typeof response.body.timestamp).toBe('string');
            expect(typeof response.body.uptime).toBe('number');
        }
    );
});