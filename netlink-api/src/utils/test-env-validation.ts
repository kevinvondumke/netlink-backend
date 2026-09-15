import assert from 'assert';
import { envSchema } from '../config/env';

console.log('\n------------------------------------------------------------------------');
console.log('STARTING ENVIRONMENT CONFIGURATION VALIDATION TEST SUITE');
console.log('------------------------------------------------------------------------');

// 1. TEST VALID CONFIGURATION
console.log('▶ [1/5] Testing Valid Configuration Parsing...');
{
    const validRaw = {
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/netlink',
        JWT_SECRET: 'super-secret-key-at-least-10-chars'
    };

    const parsed = envSchema.parse(validRaw);
    assert.strictEqual(parsed.NODE_ENV, 'production');
    assert.strictEqual(parsed.PORT, 8080, 'PORT must be coerced from string to number');
    assert.strictEqual(parsed.DATABASE_URL, 'postgresql://user:pass@localhost:5432/netlink');
    assert.strictEqual(parsed.JWT_SECRET, 'super-secret-key-at-least-10-chars');
    console.log('  ✔ Valid environment correctly parsed and typed.');
}

// 2. TEST DEFAULTS (PORT & NODE_ENV)
console.log('▶ [2/5] Testing Default Fallbacks (PORT & NODE_ENV)...');
{
    const minimalRaw = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/netlink',
        JWT_SECRET: 'super-secret-key-at-least-10-chars'
    };

    const parsed = envSchema.parse(minimalRaw);
    assert.strictEqual(parsed.PORT, 4400, 'PORT must default to 4400 when omitted');
    assert.strictEqual(parsed.NODE_ENV, 'development', 'NODE_ENV must default to development');
    console.log('  ✔ Default fallbacks verified.');
}

// 3. TEST MISSING DATABASE_URL REJECTION
console.log('▶ [3/5] Testing Missing DATABASE_URL Rejection...');
{
    const missingDb = {
        JWT_SECRET: 'super-secret-key-at-least-10-chars'
    };

    const result = envSchema.safeParse(missingDb);
    assert.strictEqual(result.success, false, 'Must fail when DATABASE_URL is missing');
    if (!result.success) {
        const issue = result.error.issues.find(i => i.path.includes('DATABASE_URL'));
        assert.ok(issue, 'Must report DATABASE_URL issue');
    }
    console.log('  ✔ Missing DATABASE_URL safely rejected.');
}

// 4. TEST MISSING OR SHORT JWT_SECRET REJECTION
console.log('▶ [4/5] Testing Missing & Short JWT_SECRET Rejection...');
{
    const shortJwt = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/netlink',
        JWT_SECRET: 'short' // less than 10 chars
    };

    const result = envSchema.safeParse(shortJwt);
    assert.strictEqual(result.success, false, 'Must fail when JWT_SECRET is under 10 chars');
    if (!result.success) {
        const issue = result.error.issues.find(i => i.path.includes('JWT_SECRET'));
        assert.ok(issue, 'Must report JWT_SECRET issue');
    }
    console.log('  ✔ Short / insecure JWT_SECRET safely rejected.');
}

// 5. TEST INVALID NODE_ENV REJECTION
console.log('▶ [5/5] Testing Invalid NODE_ENV Enum Rejection...');
{
    const invalidEnv = {
        NODE_ENV: 'staging', // Not in ['development', 'production', 'test']
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/netlink',
        JWT_SECRET: 'super-secret-key-at-least-10-chars'
    };

    const result = envSchema.safeParse(invalidEnv);
    assert.strictEqual(result.success, false, 'Must fail for unsupported NODE_ENV values');
    console.log('  ✔ Invalid NODE_ENV safely rejected.');
}

console.log('\n🎉 ALL 5 ENVIRONMENT VALIDATION TESTS PASSED!\n');
