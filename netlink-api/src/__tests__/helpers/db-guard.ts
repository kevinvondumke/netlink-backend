// SAFETY ASSERTION
/**
 * ASSERTS THAT THE CURRENT RUNTIME ENVIRONMENT AND DATABASE URL
 * ARE STRICTLY TARGETING AN ISOLATED TEST DATABASE.
 * 
 * --> THROWS A FATAL ERROR IF THERE IS ANY AMBIGUITY OR RISK OF
 * TOUCHING A DEVELOPMENT || PROD DATABASE.
**/

import { env } from '../../config/env';

export function assertTestDatabase(): void {
    if (env.NODE_ENV !== 'test') {
        throw new Error(
            `\nCRITICAL SAFETY ERROR: REFUSING TO PERFORM TEST DATABASE OPERATION!\n` +
            `EXPECTED NODE_ENV TO BE 'test', BUT RECEIVED ---> '${env.NODE_ENV}'.\n`
        );
    }

    const DB_URL = env.DATABASE_URL.toLowerCase();

    // THE DB URL MUST CONTAIN 'test' || 'netlink-test
    const isTestDB = DB_URL.includes('netlink_test') || DB_URL.includes('_test');

    if (!isTestDB) {
        throw new Error(
            `\nCRITICAL SAFETY ERROR: DATABASE_URL DOES NOT POINT TO AN ISOLATED TEST DATABASE!\n` +
            `TARGET URL APPEARS TO BE development || production: ${env.DATABASE_URL}\n`
        );
    }
}