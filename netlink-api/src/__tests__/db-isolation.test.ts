import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { prisma } from '../config/prisma';
import { assertTestDatabase } from './helpers/db-guard';
import { clearTestDatabase } from './helpers/db-reset';
import { createTestUser } from './helpers/user-factory';

describe('Database Isolation and Safety Checks', () => {
    // RESET DB
    beforeEach(async () => {
        await clearTestDatabase();
    });

    // DISCONNECT
    afterAll(async () => {
        await clearTestDatabase();
        await prisma.$disconnect();
    });

    // TEST #1
    it('confirms assertTestDatabase() passes for current test config', () => {
        expect(() => assertTestDatabase()).not.toThrow();
    });

    // TEST #2
    it('creates a user fixture in the isolated test db', async () => {
        // ARRANGE
        const user = await createTestUser({ name: 'Kevin Test' });

        // ACT
        const foundUser = await prisma.user.findUnique({
            where: { id: user.id }
        });

        // ASSERT
        expect(foundUser).not.toBeNull();
        expect(foundUser?.email).toBe(user.email);
        expect(foundUser?.name).toBe('Kevin Test');
    });

    // TEST #3
    it('verifies clearTestDatabase() resets the db to zero records', async () => {
        // ARRANGE #1
        await createTestUser();
        await createTestUser();

        // ACT #1
        const countBefore = await prisma.user.count();

        // ASSERT #1
        expect(countBefore).toBe(2);

        // ACT #2
        await clearTestDatabase();

        // ACT #2
        const countAfter = await prisma.user.count();

        // ASSERT #2
        expect(countAfter).toBe(0);
    });
});