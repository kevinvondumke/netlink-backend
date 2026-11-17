import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

let redisClient: ReturnType<typeof createClient> | undefined;

if (redisUrl) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (error) => {
        console.error('Redis rate-limit store error:', error);
    });
    void redisClient.connect().catch((error) => {
        console.error('Redis rate-limit store connection failed:', error);
    });
}
function createStore(windowMs: number, prefix: string) {
    if (!redisClient) {
        return undefined;
    }
    return new RedisStore({
        prefix,
        sendCommand: (...command: string[]) => redisClient!.sendCommand(command),
    });
}

const commonOptions = {
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    statusCode: 429,
    passOnStoreError: false,
};

const authStore = createStore(15 * 60 * 1000, 'netlink:ratelimit:auth');
const apiStore = createStore(15 * 60 * 1000, 'netlink:ratelimit:api');

// AUTH LIMITER: 10 requests per 15 minutes
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'production' ? 10 : 1000,
    message: { error: 'Too many authentication attempts. Please try again later.' },
    ...(authStore ? { store: authStore } : {}),
});

// GLOBAL API LIMITER: 300 requests per 15 minutes
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 300,
    message: { error: 'Too many requests. Please try again later.' },
    ...(apiStore ? { store: apiStore } : {}),
});