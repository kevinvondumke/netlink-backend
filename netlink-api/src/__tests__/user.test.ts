import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { createAuthenticatedAgent } from './helpers/auth-helper';
import { clearTestDatabase } from './helpers/db-reset';
import { createTestUser } from './helpers/user-factory';

describe('USER INTEGRATION TESTS | /users', () => {
    const app = createApp();

    beforeEach(async () => {
        await clearTestDatabase();
    });

    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    // TEST #1
    describe('GET /users/me', () => {
        // TEST CASE #1
        it("returns the authenticated user's profile with 200 OK.", async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app, {
                name: 'Test User',
                bio: 'Hello World!',
            });

            // ACT
            const response = await agent.get('/users/me');

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(user.id);
            expect(response.body.email).toBe(user.email);
            expect(response.body.name).toBe(user.name);
            expect(response.body.bio).toBe('Hello World!');
            expect(response.body.password).toBeUndefined();
        });

        // TEST CASE #2
        it('rejects unauthenticated requests with 401 Unauthorized.', async () => {
            // ARRANGE + ACT
            const response = await request(app).get('/users/me');

            // ASSERT
            expect(response.status).toBe(401);
        });
    });

    // TEST #2
    describe('GET /users/:id', () => {
        // TEST CASE #1
        it("returns the target's profile with 200 OK.", async () => {
            // ARRANGE
            const { agent } = await createAuthenticatedAgent(app, {});
            const target = await createTestUser({
                name: 'Bob Target',
                bio: 'Target Bio'
            });

            // ACT
            const response = await agent.get(`/users/${target.id}`);

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(target.id);
            expect(response.body.name).toBe('Bob Target');
            expect(response.body.bio).toBe('Target Bio');
            expect(response.body.followersCount).toBe(0);
            expect(response.body.password).toBeUndefined();
        });

        // TEST CASE #2
        it("rejects the target's profile request with 400 Not Found", async () => {
            // ARRANGE
            const { agent } = await createAuthenticatedAgent(app, {});

            // ACT
            const response = await agent.get('/users/non-existent-user-id-999.');

            // ASSERT
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('User not found');
        });
    });

    // TEST #3
    describe('PATCH /users/me', () => {
        // TEST CASE #1
        it("updates the authenticated user's profile with 200 OK.", async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app, {
                name: 'Old Name',
                bio: 'Old Bio'
            });

            // ACT
            const response = await agent.patch('/users/me').send({
                name: 'New Name',
                bio: 'Updated Bio'
            });

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Name');
            expect(response.body.bio).toBe('Updated Bio');
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            expect(dbUser?.name).toBe('New Name');
            expect(dbUser?.bio).toBe('Updated Bio');
        });

        // TEST CASE #2
        it('rejects a duplicate username update with 409 Conflict.', async () => {
            // ARRANGE
            await createTestUser({ username: 'taken_username' });
            const { agent } = await createAuthenticatedAgent(app, {});

            // ACT
            const response = await agent.patch('/users/me').send({
                username: 'taken_username'
            });

            // ASSERT
            expect(response.status).toBe(409);
            expect(response.body.error).toBe('A record with this field already exists.');
        });
    });

    // TEST #4
    describe('DELETE /users/me', () => {
        // CASE #1
        it('deletes authenticated user and verifies cascade deletion of related posts in PostgreSQL with 200 OK.', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await prisma.post.create({
                data: {
                    authorId: user.id,
                    content: 'This is a test post.'
                }
            });

            // ACT
            const response = await agent.delete('/users/me');

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Account deleted successfully.');
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            expect(dbUser).toBeNull();
            const dbPost = await prisma.post.findUnique({ where: { id: post.id } });
            expect(dbPost).toBeNull();
        });

        // CASE #2
        it('rejects unauthenticated deletion requests with 401 Unauthorized.', async () => {
            // ARRANGE + ACT
            const response = await request(app).delete('/users/me');

            // ASSERT
            expect(response.status).toBe(401);
        });
    });
});