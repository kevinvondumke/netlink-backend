import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { createAuthenticatedAgent } from './helpers/auth-helper';
import { clearTestDatabase } from './helpers/db-reset';
import { createTestPost } from './helpers/post-factory';
import { createTestUser } from './helpers/user-factory';

describe('COMMENT INTEGRATION TESTS | /comment', () => {
    const app = createApp();

    beforeEach(async () => {
        await clearTestDatabase();
    });

    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    // TEST #1
    describe('POST /post/comment/:id | CREATE COMMENT', async () => {
        // CASE: CREATE COMMENT
        it('successfully creates a comment on a existing post with 201 Created', async () => {
            // ARRANGE
            const postAuthor = await createTestUser();
            const post = await createTestPost(postAuthor.id);
            const { agent, user: commentAuthor } = await createAuthenticatedAgent(app);
            const payload = {
                content: 'Great perspective on this topic!'
            };

            // ACT
            const response = await agent.post(`/post/comment/${post.id}`).send(payload);

            // ASSERT
            expect(response.status).toBe(201);
            expect(response.body.content).toBe(payload.content);
            expect(response.body.author.id).toBe(commentAuthor.id);
            expect(response.body.author.username).toBe(commentAuthor.username);
            const commentInDb = await prisma.comment.findUnique({
                where: { id: response.body.id },
            });
            expect(commentInDb).not.toBeNull();
            expect(commentInDb?.authorId).toBe(commentAuthor.id);
            expect(commentInDb?.content).toBe(payload.content);
        });

        // CASE: CREATE COMMENT WITH EMPTY CONTENT | 400 BAD REQUEST
        it('rejects comment creation with 400 Bad Request when content is empty', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await createTestPost(user.id);
            const payload = {
                content: '    '
            };

            // ACT
            const response = await agent.post(`/post/comment/${post.id}`).send(payload);

            // ASSERT
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Comment cannot be empty.');
            expect(await prisma.comment.count()).toBe(0);
        });

        // CASE: CREATE COMMENT WITH EXCESSIVE LENGTH > 500 CHARS | 400 BAD REQUEST
        it('rejects comment creation with 400 Bad Request when content is excessive length', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await createTestPost(user.id);
            const payload = {
                content: 'a'.repeat(501)
            };

            // ACT 
            const response = await agent.post(`/post/comment/${post.id}`).send(payload);

            // ASSERT
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Comment cannot exceed 500 characters.');
            expect(await prisma.comment.count()).toBe(0);
        });

        // CASE: CREATE COMMENT ON NON-EXISTENT POST | 404 NOT FOUND
        it('rejects comment creation with 404 Not Found when post does not exist', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);

            // ACT
            const response = await agent.post('/post/comment/00000000-0000-0000-0000-000000000000').send({
                content: 'Ghost comment'
            });

            // ASSERT
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Post not found.');
            expect(await prisma.comment.count()).toBe(0);
        });

        // CASE: CREATE COMMENT WITH UNAUTHENTICATED REQUEST | 401 UNAUTHORIZED
        it('rejects comment creation with 401 Unauthorized when user is not authenticated', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await createTestPost(user.id);
            const payload = {
                content: 'Anonymous attemp'
            };

            // ACT
            const response = await request(app).post(`/post/comment/${post.id}`).send(payload);

            // ASSERT
            expect(response.status).toBe(401);
            expect(await prisma.comment.count()).toBe(0);
        });
    });

    // TEST #2
    describe('DELETE /post/comment/:id | DELETE COMMENT', async () => {
        // CASE: OWNER DELETES COMMENT | 200 OK
        it('successfuly deletes a comment by its owner with 200 OK', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);
            const post = await createTestPost(user.id);
            const comment = await agent.post(`/post/comment/${post.id}`).send({
                content: 'This is a comment to be deleted.'
            });

            // ACT
            const response = await agent.delete(`/post/comment/${comment.body.id}`);

            // ASSERT
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Comment deleted successfully.');
            expect(await prisma.comment.findUnique({ where: { id: comment.body.id } })).toBeNull();
        });

        // CASE: NON-OWNER REJECTION | 403 FORBIDDEN
        it('rejects comment deletion with 403 Forbidden when user is not the owner', async () => {
            // ARRANGE
            const { agent: agentA, user: userA } = await createAuthenticatedAgent(app);
            const { agent: agentB, user: userB } = await createAuthenticatedAgent(app);
            const post = await createTestPost(userA.id);
            const comment = await agentA.post(`/post/comment/${post.id}`).send({
                content: 'This is a comment that user B will try to delete.'
            });

            // ACT
            const response = await agentB.delete(`/post/comment/${comment.body.id}`);

            // ASSERT
            expect(response.status).toBe(403);
            expect(response.body.error).toBe('You are not the owner of this comment.');
            expect(await prisma.comment.findUnique({ where: { id: comment.body.id } })).not.toBeNull();
        });

        // CASE: MISSING COMMENT | 404 NOT FOUND
        it('rejects comment deletion with 404 Not Found when comment does not exist', async () => {
            // ARRANGE
            const { agent, user } = await createAuthenticatedAgent(app);

            // ACT
            const response = await agent.delete('/post/comment/00000000-0000-0000-0000-000000000000');

            // ASSERT
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Comment not found.');
        });
    });
});

describe('RELATIONAL INTEGRITY | POST CASCADE DELETION', () => {
    const app = createApp();

    beforeEach(async () => {
        await clearTestDatabase();
    });

    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    it('cascades deletion to all associated comments and likes when a post is deleted', async () => {
        // ARRANGE
        const { agent: authorAgent, user: authorPost } = await createAuthenticatedAgent(app);
        const { agent: agentB, user: userB } = await createAuthenticatedAgent(app);
        const { agent: agentC, user: userC } = await createAuthenticatedAgent(app);
        const post = await createTestPost(authorPost.id);
        const comment1 = await prisma.comment.create({
            data: { postId: post.id, authorId: userB.id, content: 'Comment from user B' }
        });
        const comment2 = await prisma.comment.create({
            data: { postId: post.id, authorId: userC.id, content: 'Comment from user C' }
        });

        const like1 = await prisma.like.create({
            data: { postId: post.id, userId: userB.id }
        });
        const like2 = await prisma.like.create({
            data: { postId: post.id, userId: userC.id }
        });

        expect(await prisma.comment.count({ where: { postId: post.id } })).toBe(2);
        expect(await prisma.like.count({ where: { postId: post.id } })).toBe(2);

        // ACT
        const response = await authorAgent.delete(`/post/delete/${post.id}`);

        // ASSERT
        expect(response.status).toBe(200);
        expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();
        const remainingComments = await prisma.comment.findMany({ where: { postId: post.id } });
        expect(remainingComments.length).toBe(0);
        const remainingLikes = await prisma.like.findMany({ where: { postId: post.id } });
        expect(remainingLikes.length).toBe(0);
    });
});