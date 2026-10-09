import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { clearTestDatabase } from './helpers/db-reset';
import { createTestUser } from './helpers/user-factory';
import { COOKIE_NAME } from '../utils/cookies';

describe('AUTH INTEGRATION TESTS | /auth', () => {
    const app = createApp();

    beforeEach(async () => {
        await clearTestDatabase();
    });

    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    // AUTH REGISTER TESTS
    describe('POST /auth/register', () => {
        // TEST CASE #1
        it('registers a new user, hashes password, sets auth cookie and retuns 201', async () => {
            // ARRANGE
            // -----------------------------------------------------------------------------------
            // PAYLOAD WITH VALID EMAIL, NAME, AND STRONG PASSWORD
            const payload = {
                email: 'testuser@netlink.com',
                name: 'Test User',
                password: 'StrongPassword123!'
            }

            // ACT
            // -----------------------------------------------------------------------------------
            const response = await request(app).post('/auth/register').send(payload);

            // ASSERT
            // -----------------------------------------------------------------------------------
            // HTTP STATUS CODE 201
            expect(response.status).toBe(201);

            // JSON CONTRACT
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user).toHaveProperty('email', payload.email);
            expect(response.body.user).toHaveProperty('name', payload.name);

            // PASS OMITTED FROM JSON RESPONSE
            expect(response.body.user).not.toHaveProperty('password');

            // SET-COOKIE HEADER HAS AUTH_TOKEN AND HTTPONLY FLAG
            const cookies = response.headers['set-cookie'] as unknown as string[];
            expect(cookies).toBeDefined();
            expect(cookies[0]).toContain(COOKIE_NAME);
            expect(cookies[0]).toContain('HttpOnly');

            // PROVE ROW EXISTS.
            const dbUser = await prisma.user.findUnique({ where: { email: payload.email } });
            expect(dbUser).not.toBeNull();

            // STORED PASSWORD IS AN ENCRYPTED BCRYPT HASH
            expect(dbUser?.password).not.toBe(payload.password);
            expect(dbUser?.password).toMatch(/^\$2[ayb]\$/);
        });

        // TEST CASE #2
        it('rejects duplicate email with 409 Conflict', async () => {
            // ARRANGE
            // CREATE A USER IN THE DATABASE WITH THE SAME EMAIL
            const existingUser = await createTestUser({ email: 'existing@netlink.com' });            

            // ACT
            const payload = {
                email: existingUser.email,
                name: 'New User',
                password: 'AnotherStrongPassword123!'
            }

            const response = await request(app).post('/auth/register').send(payload);

            // ASSERT
            expect(response.status).toBe(409);
            expect(response.body.error).toBe('Email already exists.');
            const dbUser = await prisma.user.count({ where: { email: 'existing@netlink.com' } });
            expect(dbUser).toBe(1);
        });

        // TEST CASE #3
        it('Rejects invalid email with 400 Bad Request', async () => {
            // ARRANGE
            const payload = {
                email: 'not-an-email',
                name: 'Valid Name',
                password: 'ValidPassword123!'
            };

            // ACT
            const response = await request(app).post('/auth/register').send(payload);

            // ASSERT
            expect(response.status).toBe(400);
            expect(response.body.status).toBe('fail');
            const dbUser = await prisma.user.count({ where: { email: payload.email } });
            expect(dbUser).toBe(0);
        });

        // TEST CASE #4
        it('rejects weak password with 400 Bad Request', async () => {
            // ARRANGE
            const payload = {
                email: 'user@netlink.com',
                name: 'User Name',
                password: '123'
            };

            // ACT
            const response = await request(app).post('/auth/register').send(payload);

            // ASSERT
            expect(response.status).toBe(400);
            const dbUser = await prisma.user.count({ where: { email: payload.email } });
            expect(dbUser).toBe(0);
        });
    });

    // AUTH LOGIN TESTS
    describe('POST /auth/login', async () => {
        // TEST CASE #1
        it('successfully logs and returns 200', async () => {
            // ARRANGE
            const plainPass = 'plainPassword123!';
            const user = await createTestUser({ plainPassword: plainPass });

            // ACT
            const response = await request(app).post('/auth/login').send({
                email: user.email,
                password: plainPass
            });

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.user.email).toBe(user.email);
            expect(response.body.user.id).toBe(user.id);
            expect(response.body.user.password).toBeUndefined();
            const cookies = response.headers['set-cookie'] as unknown as string[];
            expect(cookies).toBeDefined();
            expect(cookies[0]).toContain(COOKIE_NAME);
            expect(cookies[0]).toContain('HttpOnly');
        });

        // TEST CASE #2
        it('rejects invalid password with 401 Unauthorized', async () => {
            // ARRANGE
            const plainPass = 'correctPassword123!';
            const user = await createTestUser({ plainPassword: plainPass });

            // ACT
            const response = await request(app).post('/auth/login').send({
                email: user.email,
                password: 'WrongPassword123!'
            });

            // ASSERT
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid login credentials.');
            expect(response.headers['set-cookie']).toBeUndefined();
        });

        // TEST CASE #3
        it('rejects non-existent email with 401 Unauthorized', async () => {
            // ARRANGE
            const randomEmail = 'nobody@netlink.com';

            // ACT
            const response = await request(app).post('/auth/login').send({
                email: randomEmail,
                password: 'AnyPassword123!'
            });

            // ASSERT
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid login credentials.');
            expect(response.headers['set-cookie']).toBeUndefined();
        });

        // TEST CASE #4
        it('rejects request for missing password in payload with 400 Bad Request', async () => {
            // ARRANGE
            const payload = {
                email: 'user@netlink.com'
            };

            // ACT
            const response = await request(app).post('/auth/login').send({
                email: payload.email
            });

            // ASSERT
            expect(response.status).toBe(400);
            expect(response.body.status).toBe('fail');
        });
    });

    // AUTH LOGOUT TESTS
    describe('POST /auth/logout', async () => {
        it('logs out an active session and clears the auth cookie.', async () => {
            // ARRANGE
            const agent = request.agent(app);
            const plainPass = 'plainPassword123!';
            const user = await createTestUser({ plainPassword: plainPass });            

            // ACT AND ASSERT --> LOGIN            
            const response = await agent.post('/auth/login').send({
                email: user.email,
                password: plainPass
            });
            expect(response.status).toBe(200);

            // ACT AND ASSERT --> LOGOUT
            const logoutResponse = await agent.post('/auth/logout');
            expect(logoutResponse.status).toBe(200);
            expect(logoutResponse.body.message).toBe('Logged out successfully.');
            expect(logoutResponse.headers['set-cookie']).not.toContain(COOKIE_NAME);

            const userTest = await agent.get('/users/test');
            expect(userTest.status).toBe(401);
        }  );
    });
});