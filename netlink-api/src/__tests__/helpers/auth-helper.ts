import request from 'supertest';
import { Express } from 'express';
import { createTestUser, CreateTestUserOverrides } from './user-factory';

/**
 * CREATES A TEST USER IN POSTGRESQL --> LOGS IN VIA SUPERTEST AGENT.
 * RETURNS BOTH THE LOGGED IN AGENT (WITH COOKIE JAR) AND THE CREATED USER MODEL. 
**/

export async function createAuthenticatedAgent(app: Express, overrides: CreateTestUserOverrides = {}) {
    const user = await createTestUser(overrides);
    const agent = request.agent(app);

    await agent.post('/auth/login').send({
        email: user.email,
        password: user.plainPass
    });

    return { agent, user };
};