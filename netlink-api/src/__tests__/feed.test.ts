import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { createAuthenticatedAgent } from './helpers/auth-helper';
import { clearTestDatabase } from './helpers/db-reset';
import { createTestPost } from './helpers/post-factory';
import { createTestUser } from './helpers/user-factory';

describe('FEED INTEGRATION TESTS | /post', () => {
    const app = createApp();

    beforeEach(async () => {
        await clearTestDatabase();
    });

    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    // TEST #1
    it('paginates feed deterministically across multiple pages using cursor', async () => {
        // ARRANGE
        const { agent } = await createAuthenticatedAgent(app);
        const author = await createTestUser();

        const post1 = await createTestPost(
            author.id,
            { createdAt: new Date('2026-01-01T10:00:00Z') }
        );
        const post2 = await createTestPost(
            author.id,
            { createdAt: new Date('2026-01-01T11:00:00Z') }
        );
        const post3 = await createTestPost(
            author.id,
            { createdAt: new Date('2026-01-01T12:00:00Z') }
        );

        // ACT
        const page1Response = await agent.get('/post/all?limit=2');

        // ASSERT --> PAGE 1
        expect(page1Response.status).toBe(200);
        expect(page1Response.body.posts.length).toBe(2);
        expect(page1Response.body.posts[0].id).toBe(post3.id);
        expect(page1Response.body.posts[1].id).toBe(post2.id);
        expect(page1Response.body.nextCursor).not.toBeNull();

        // ARRANGE #2
        const nextCursor = page1Response.body.nextCursor;

        // ACT #2
        const page2Response = await agent.get(`/post/all?limit=2&cursor=${nextCursor}`);

        // ASSERT --> PAGE 2
        expect(page2Response.status).toBe(200);
        expect(page2Response.body.posts.length).toBe(1);
        expect(page2Response.body.posts[0].id).toBe(post1.id);
        expect(page2Response.body.nextCursor).toBeNull();
    });
});