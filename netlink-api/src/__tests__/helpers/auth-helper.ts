import request from 'supertest';
import { Express } from 'express';
import { createTestUser, CreateTestUserOverrides } from './user-factory';
import { signToken } from '../../services/jwt.service';
import { COOKIE_NAME } from '../../utils/cookies';

/**
 * CREATES A TEST USER IN POSTGRESQL --> LOGS IN VIA SUPERTEST AGENT.
 * RETURNS BOTH THE LOGGED IN AGENT (WITH COOKIE JAR) AND THE CREATED USER MODEL. 
**/

export async function createAuthenticatedAgent(app: Express, overrides: CreateTestUserOverrides = {}) {
    const user = await createTestUser(overrides);
    const agent = request.agent(app);

    const token = signToken({ id: user.id, email: user.email });
    agent.jar.setCookie(`${COOKIE_NAME}=${token}`);

    return { agent, user };
};