import { prisma } from '../../config/prisma';
import { assertTestDatabase } from './db-guard';

export interface CreateTestPostOverrides {
    content?: string;
    visibility?: 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME' | 'SPECIFIC';
    location?: string;
    createdAt?: Date;
}

export async function createTestPost(authorId: string, overrides: CreateTestPostOverrides = {}) {
    assertTestDatabase();

    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return await prisma.post.create({
        data: {
            authorId,
            content: overrides.content ?? `Test post content ${uniqueId}`,
            visibility: overrides.visibility ?? 'PUBLIC',
            location: overrides.location ?? null,
            ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {})
        }
    });
}