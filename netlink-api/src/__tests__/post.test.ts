import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { createAuthenticatedAgent } from './helpers/auth-helper';
import { clearTestDatabase } from './helpers/db-reset';
import { createTestPost } from './helpers/post-factory';
import { createTestUser } from './helpers/user-factory';

describe('POST INTEGRATION TESTS | /post', () => {
    const app = createApp();

    beforeEach(async () => {
        await clearTestDatabase();
    });

    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    // TEST #1
    describe('POST /post/ | CREATE POST', () => {
        // TEST CASE #1
        it('successfully creates a post and persists it to the database with 201 Created', async () => {
            // ARRANGE            
            const { agent, user } = await createAuthenticatedAgent(app);

            const payload = {
                content: 'Hello Netlink integration testing',
                visibility: 'PUBLIC',
                location: 'Buenos Aires, Argentina'
            };

            // ACT
            const response = await agent.post('/post/').send(payload);

            // ASSERT
            expect(response.status).toBe(201);
            expect(response.body.content).toBe('Hello Netlink integration testing');
            expect(response.body.authorId).toBe(user.id);
            expect(response.body.location).toBe('Buenos Aires, Argentina');
            expect(response.body.visibility).toBe('PUBLIC');
            const postInDb = await prisma.post.findUnique({
                where: { id: response.body.id },
            });
            expect(postInDb).not.toBeNull();
            expect(postInDb?.authorId).toBe(user.id);
            expect(postInDb?.content).toBe(payload.content);
        });

        // TEST CASE #2
        it('rejects post creation with 401 Unauthorized when unauthenticated', async () => {
            // ARRANGE + ACT
            const payload = {
                content: 'Unauthenticated attempt to create a post',
            }
            const response = await request(app).post('/post/').send(payload);

            // ASSERT
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication cookie missing.');
            const postInDb = await prisma.post.findFirst({
                where: { content: 'Unauthenticated attempt to create a post' }
            });
            expect(postInDb).toBeNull();
        });

        // TEST CASE #3
        it('rejects post creation with 400 Bad Request when content is missing', async () => {
            // ARRANGE
            const payload = {
                content: '   ',
            };
            const { agent, user } = await createAuthenticatedAgent(app);

            // ACT
            const response = await agent.post('/post/').send(payload);

            // ASSERT
            expect(response.status).toBe(400);
            expect(await prisma.post.count()).toBe(0);
        });

        // TEST CASE #4
        it('rejects post creation with 400 Bad Request when visibility is invalid', async () => {
            // ARRANGE
            const payload = {
                content: 'Valid content',
                visibility: 'INVALID_VISIBILITY'
            };
            const { agent, user } = await createAuthenticatedAgent(app);

            // ACT
            const response = await agent.post('/post/').send(payload);

            // ASSERT
            expect(response.status).toBe(400);
            expect(await prisma.post.count()).toBe(0);
        });
    });

    // TEST #2
    describe('GET /post/p/:id | GET SINGLE POST', () => {
        // TEST CASE #1
        it('returns post details with 200 OK when post exists', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await prisma.post.create({
                data: {
                    authorId: user.id,
                    content: 'This is a test post.'
                }
            });

            // ACT
            const response = await agent.get(`/post/p/${post.id}`);

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(post.id);
            expect(response.body.content).toBe(post.content);
            expect(response.body.author.id).toBe(user.id);
            expect(response.body.author.username).toBe(user.username);
            expect(response.body._count).contain({ likes: 0, comments: 0, shares: 0 });
        });

        // TEST CASE #2
        it('returns 404 Not Found when post does not exist', async () => {
            // ARRANGE
            const { agent } = await createAuthenticatedAgent(app);

            // ACT
            const response = await agent.get('/post/p/00000000-0000-0000-0000-000000000000');

            // ASSERT
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Post not found.');
        });
    });

    // TEST #3
    describe('PUT /post/update/:id | UPDATE POST', () => {
        // CASE: HAPPY PATH --> OWNER UPDATES POST
        it('successfully updates a post with 200 OK when user is the owner', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await createTestPost(user.id);

            // ACT
            const response = await agent.put(`/post/update/${post.id}`).send({
                content: 'Updated content',
            });

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.post.content).toBe('Updated content');
            const updatedPostInDb = await prisma.post.findUnique({ where: { id: post.id } });
            expect(updatedPostInDb?.content).toBe('Updated content');
        });

        // CASE: OWNERSHIP REJECTION --> NON-OWNER CANNOT UPDATE
        it('rejects post update with 403 Forbidden when user is not the owner', async () => {
            // ARRANGE
            const { agent: agentA, user: userA } = await createAuthenticatedAgent(app);
            const { agent: agentB, user: userB } = await createAuthenticatedAgent(app);
            const post = await createTestPost(userA.id, {
                content: 'Original content'
            });

            // ACT
            const response = await agentB.put(`/post/update/${post.id}`).send({
                content: 'Hacked content'
            });

            // ASSERT
            expect(response.status).toBe(403);
            const updatedPostInDb = await prisma.post.findUnique({ where: { id: post.id } });
            expect(updatedPostInDb?.content).toBe('Original content');
        });
    });

    // TEST #4
    describe('DELETE /post/delete/:id | DELETE POST', () => {
        // CASE: HAPPY PATH --> OWNER DELETES POST
        it('successfully deletes a post with 200 OK when user is the owner', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await createTestPost(user.id);

            // ACT
            const response = await agent.delete(`/post/delete/${post.id}`);

            // ASSERT
            expect(response.status).toBe(200);
            const deletedPostInDb = await prisma.post.findUnique({ where: { id: post.id } });
            expect(deletedPostInDb).toBeNull();
        });

        // CASE: OWNERSHIP REJECTION --> NON-OWNER CANNOT DELETE
        it('rejects post deletion with 403 Forbidden when user is not the owner', async () => {
            // ARRANGE
            const { agent: agentA, user: userA } = await createAuthenticatedAgent(app);
            const { agent: agentB, user: userB } = await createAuthenticatedAgent(app);
            const post = await createTestPost(userA.id, {
                content: 'Original content'
            });

            // ACT
            const response = await agentB.delete(`/post/delete/${post.id}`);

            // ASSERT
            expect(response.status).toBe(403);
            const postInDb = await prisma.post.findUnique({ where: { id: post.id } });
            expect(postInDb).not.toBeNull();
        });
    });
});