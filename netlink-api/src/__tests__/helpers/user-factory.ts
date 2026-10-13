// SEED | FIXTURE CREATOR
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { assertTestDatabase } from './db-guard';

export interface CreateTestUserOverrides {
    email?: string;
    plainPassword?: string;
    name?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
    privacyMode?: boolean;
}

/**
 * CREATES A UNIQUE TEST USER IN THE ISOLATED TEST DB.
 * USES BCRYPT HASHING --> LOGIN TESTS CAN VERIFY AGAINST THE HASHED PASSWORD. 
**/

export async function createTestUser(overrides: CreateTestUserOverrides = {}) {
    assertTestDatabase();

    const uniqueID = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const plainPass = overrides.plainPassword ?? 'Password123!';
    const hashedPass = await bcrypt.hash(plainPass, 8);

    const user = await prisma.user.create({
        data: {
            email: overrides.email ?? `user_${uniqueID}@netlink.test`,
            password: hashedPass,
            name: overrides.name ?? `Test User ${uniqueID}`,
            username: overrides.username ?? `testuser_${uniqueID}`,
            bio: overrides.bio ?? `Automated test user biography`,
            avatarUrl: overrides.avatarUrl ?? null,
            privacyMode: overrides.privacyMode ?? false
        }
    });

    return {
        ...user,
        plainPass
    };
}