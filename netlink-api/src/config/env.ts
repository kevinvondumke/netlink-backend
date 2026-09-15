import dotenv from 'dotenv';
import { z } from 'zod';

// LOAD .ENV ONCE <- PARSING ENV VARIABLES
dotenv.config();

// DEF ENV SCHEMA
export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4400),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL IS REQUIRED'),
    JWT_SECRET: z.string().min(10, 'JWT_SECRET IS REQUIRED AND MUST BE AT LEAST 10 CHARACTERS LONG.'),
    REDIS_URL: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

// PARSE AND VALIDATE ENV VARIABLES
function validateEnv(): Env {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('\n======================================================');
        console.error('❌ CONFIGURATION ERROR: INVALID ENVIRONMENT VARAIBLES:');
        for (const issue of result.error.issues) {
            const varName = issue.path.join('.');
            console.error(`    • ${varName}: ${issue.message}`);
        }
        console.error('======================================================\n');
        process.exit(1);
    }

    return result.data;
}

export const env = validateEnv();